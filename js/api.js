const OPEN_METEO_WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const WEATHER_REQUESTS_IN_FLIGHT = new Map();
const CITY_SEARCH_REQUESTS_IN_FLIGHT = new Map();
const AIR_QUALITY_REQUESTS_IN_FLIGHT = new Map();

function reuseInFlightRequest(requests, key, request) {
  const existingRequest = requests.get(key);
  if (existingRequest) return existingRequest;

  const pendingRequest = request().finally(() => {
    if (requests.get(key) === pendingRequest) requests.delete(key);
  });
  requests.set(key, pendingRequest);
  return pendingRequest;
}

async function fetchJson(url, serviceName) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`تعذر الاتصال بخدمة ${serviceName}. تحقق من اتصال الإنترنت وحاول مرة أخرى.`);
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`فشل طلب ${serviceName} (رمز الاستجابة ${response.status}). حاول مرة أخرى لاحقًا.`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(`تعذر قراءة البيانات الواردة من خدمة ${serviceName}.`);
  }
}

function getWeather(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("إحداثيات الموقع غير صالحة.");
  }

  const url = new URL(OPEN_METEO_WEATHER_URL);
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,rain_sum,snowfall_sum,sunrise,sunset",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    forecast_days: "7",
    timezone: "auto",
  }).toString();

  return reuseInFlightRequest(WEATHER_REQUESTS_IN_FLIGHT, url.toString(), async () => {
    const data = await fetchJson(url, "الطقس");
    if (!data || typeof data !== "object") {
      throw new Error("لم تُرجع خدمة الطقس بيانات صالحة.");
    }
    const current = data.current;
    const daily = data.daily;
    const hourly = data.hourly;

    if (!current || !daily
      || typeof current.time !== "string"
      || !Number.isFinite(current.temperature_2m)
      || !Number.isFinite(current.relative_humidity_2m)
      || !Number.isFinite(current.apparent_temperature)
      || !Number.isFinite(current.weather_code)
      || !Number.isFinite(current.wind_speed_10m)
      || !Number.isFinite(current.is_day)
      || (current.is_day !== 0 && current.is_day !== 1)
      || !Array.isArray(daily.time)
      || !Array.isArray(daily.weather_code)
      || !Array.isArray(daily.temperature_2m_max)
      || !Array.isArray(daily.temperature_2m_min)
      || !Array.isArray(daily.precipitation_sum)
      || !Array.isArray(daily.precipitation_probability_max)
      || !Array.isArray(daily.rain_sum)
      || !Array.isArray(daily.snowfall_sum)
      || !Array.isArray(daily.sunrise)
      || !Array.isArray(daily.sunset)
      || !hourly
      || !Array.isArray(hourly.time)
      || !Array.isArray(hourly.temperature_2m)
      || !Array.isArray(hourly.weather_code)
      || !Array.isArray(hourly.precipitation_probability)) {
      throw new Error("لم تُرجع خدمة الطقس بيانات مكتملة.");
    }

    const forecastLength = daily.time.length;
    if (forecastLength === 0) {
      throw new Error("لا تتوفر توقعات طقس لهذا الموقع حاليًا.");
    }

    if ([daily.weather_code, daily.temperature_2m_max, daily.temperature_2m_min, daily.precipitation_sum, daily.precipitation_probability_max, daily.rain_sum, daily.snowfall_sum, daily.sunrise, daily.sunset]
      .some((values) => values.length !== forecastLength)) {
      throw new Error("بيانات توقعات الطقس غير مكتملة.");
    }
    const isNullableNumber = (value) => value === null || Number.isFinite(value);
    if ([daily.precipitation_probability_max, daily.rain_sum, daily.snowfall_sum]
      .some((values) => values.some((value) => !isNullableNumber(value)))) {
      throw new Error("بيانات الهطول اليومية غير صالحة.");
    }

    const hourlyLength = hourly.time.length;
    if (hourlyLength === 0
      || [hourly.temperature_2m, hourly.weather_code, hourly.precipitation_probability]
        .some((values) => values.length !== hourlyLength)) {
      throw new Error("بيانات توقعات الساعات غير مكتملة.");
    }

    const currentHour = current.time.slice(0, 13);
    const currentHourIndex = hourly.time.findIndex(
      (time) => typeof time === "string" && time.slice(0, 13) === currentHour,
    );
    if (currentHourIndex === -1) {
      throw new Error("تعذر تحديد ساعة البداية في توقعات الطقس.");
    }

    const hourlyTimes = hourly.time.slice(currentHourIndex, currentHourIndex + 24);
    if (hourlyTimes.length !== 24 || hourlyTimes.some((time) => typeof time !== "string")) {
      throw new Error("لا تتوفر 24 ساعة كاملة من التوقعات لهذا الموقع.");
    }

    return {
      current: {
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        apparentTemperature: current.apparent_temperature,
        code: current.weather_code,
        windSpeed: current.wind_speed_10m,
        isDay: current.is_day,
      },
      daily: daily.time.map((date, index) => ({
        date,
        code: daily.weather_code[index],
        max: daily.temperature_2m_max[index],
        min: daily.temperature_2m_min[index],
        rain: daily.precipitation_sum[index],
        rainChance: daily.precipitation_probability_max[index],
        rainMm: daily.rain_sum[index],
        snowCm: daily.snowfall_sum[index],
        sunrise: daily.sunrise[index],
        sunset: daily.sunset[index],
      })),
      hourly: hourlyTimes.map((time, offset) => {
        const index = currentHourIndex + offset;
        if (!Number.isFinite(hourly.temperature_2m[index])
          || !Number.isFinite(hourly.weather_code[index])
          || !Number.isFinite(hourly.precipitation_probability[index])) {
          throw new Error("بيانات توقعات الساعات غير مكتملة.");
        }
        return {
          time,
          temp: hourly.temperature_2m[index],
          code: hourly.weather_code[index],
          rainChance: hourly.precipitation_probability[index],
        };
      }),
    };
  });
}

function getAirQuality(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("إحداثيات الموقع غير صالحة.");
  }

  const url = new URL(OPEN_METEO_AIR_QUALITY_URL);
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone",
    timezone: "auto",
  }).toString();

  return reuseInFlightRequest(AIR_QUALITY_REQUESTS_IN_FLIGHT, url.toString(), async () => {
    const data = await fetchJson(url, "جودة الهواء");
    const current = data && data.current;
    if (!current
      || !Number.isFinite(current.us_aqi)
      || current.us_aqi < 0) {
      throw new Error("لم تُرجع خدمة جودة الهواء بيانات مكتملة.");
    }

    const pollutantFields = [
      "pm10",
      "pm2_5",
      "carbon_monoxide",
      "nitrogen_dioxide",
      "sulphur_dioxide",
      "ozone",
    ];
    if (pollutantFields.some((field) => current[field] !== null && !Number.isFinite(current[field]))) {
      throw new Error("بيانات ملوثات الهواء غير مكتملة.");
    }

    return {
      aqi: current.us_aqi,
      pm10: current.pm10,
      pm25: current.pm2_5,
      carbonMonoxide: current.carbon_monoxide,
      nitrogenDioxide: current.nitrogen_dioxide,
      sulphurDioxide: current.sulphur_dioxide,
      ozone: current.ozone,
    };
  });
}

function searchCity(name) {
  const cityName = typeof name === "string" ? name.trim() : "";
  if (!cityName) {
    throw new Error("أدخل اسم مدينة للبحث عنها.");
  }

  const url = new URL(OPEN_METEO_GEOCODING_URL);
  url.search = new URLSearchParams({
    name: cityName,
    count: "5",
    language: "ar",
  }).toString();

  return reuseInFlightRequest(
    CITY_SEARCH_REQUESTS_IN_FLIGHT,
    cityName.toLocaleLowerCase(),
    async () => {
      const data = await fetchJson(url, "البحث عن المدن");
      if (!data || !Array.isArray(data.results) || data.results.length === 0) {
        throw new Error(`لم يتم العثور على نتائج للمدينة "${cityName}". تحقق من الاسم وحاول مرة أخرى.`);
      }

      return data.results.map((result) => {
        if (!result || typeof result.name !== "string"
          || !Number.isFinite(result.latitude)
          || !Number.isFinite(result.longitude)) {
          throw new Error("أعادت خدمة البحث نتيجة مدينة غير مكتملة.");
        }

        return {
          name: result.name,
          country: result.country ?? "",
          admin1: result.admin1 ?? "",
          latitude: result.latitude,
          longitude: result.longitude,
        };
      });
    },
  );
}