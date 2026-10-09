const WEATHER_CODE_INFO = Object.freeze({
  0: { description: "سماء صافية", icon: "☀️" },
  1: { description: "غائم غالبًا", icon: "🌤️" },
  2: { description: "غائم جزئيًا", icon: "⛅" },
  3: { description: "غائم", icon: "☁️" },
  45: { description: "ضباب", icon: "🌫️" },
  48: { description: "ضباب متجمد", icon: "🌫️" },
  51: { description: "رذاذ خفيف", icon: "🌦️" },
  53: { description: "رذاذ متوسط", icon: "🌦️" },
  55: { description: "رذاذ كثيف", icon: "🌧️" },
  56: { description: "رذاذ متجمد خفيف", icon: "🌧️" },
  57: { description: "رذاذ متجمد كثيف", icon: "🌧️" },
  61: { description: "مطر خفيف", icon: "🌦️" },
  63: { description: "مطر متوسط", icon: "🌧️" },
  65: { description: "مطر غزير", icon: "🌧️" },
  66: { description: "مطر متجمد خفيف", icon: "🌧️" },
  67: { description: "مطر متجمد غزير", icon: "🌧️" },
  71: { description: "تساقط ثلوج خفيف", icon: "🌨️" },
  73: { description: "تساقط ثلوج متوسط", icon: "🌨️" },
  75: { description: "تساقط ثلوج كثيف", icon: "❄️" },
  77: { description: "حبيبات ثلجية", icon: "🌨️" },
  80: { description: "زخات مطر خفيفة", icon: "🌦️" },
  81: { description: "زخات مطر متوسطة", icon: "🌧️" },
  82: { description: "زخات مطر غزيرة", icon: "⛈️" },
  85: { description: "زخات ثلجية خفيفة", icon: "🌨️" },
  86: { description: "زخات ثلجية كثيفة", icon: "❄️" },
  95: { description: "عاصفة رعدية", icon: "⛈️" },
  96: { description: "عاصفة رعدية مع برد خفيف", icon: "⛈️" },
  99: { description: "عاصفة رعدية مع برد كثيف", icon: "⛈️" },
});

function weatherCodeToInfo(code) {
  return WEATHER_CODE_INFO[code] ?? {
    description: "حالة طقس غير معروفة",
    icon: "🌡️",
  };
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("ar", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatTemp(value) {
  return `${Math.round(value)}°`;
}

function precipitationInfo(day) {
  if (Number.isFinite(day && day.snowCm) && day.snowCm > 0) {
    return { type: "ثلج", icon: "❄️" };
  }
  if (Number.isFinite(day && day.rainMm) && day.rainMm > 0) {
    return { type: "مطر", icon: "💧" };
  }
  return { type: "لا هطول", icon: "—" };
}

function aqiToInfo(aqi) {
  if (!Number.isFinite(aqi) || aqi < 0) {
    throw new Error("قيمة مؤشر جودة الهواء غير صالحة.");
  }

  if (aqi <= 50) {
    return {
      level: "good",
      category: "جيد",
      color: "#16834a",
      advice: "جودة الهواء جيدة، ويمكن ممارسة الأنشطة الخارجية كالمعتاد.",
    };
  }
  if (aqi <= 100) {
    return {
      level: "moderate",
      category: "متوسط",
      color: "#8a6b00",
      advice: "جودة الهواء مقبولة، وقد يتأثر عدد قليل من الأشخاص الحساسين.",
    };
  }
  if (aqi <= 150) {
    return {
      level: "sensitive",
      category: "غير صحي للفئات الحساسة",
      color: "#b65300",
      advice: "يُفضّل للفئات الحساسة تقليل النشاط الطويل أو الشاق في الخارج.",
    };
  }
  if (aqi <= 200) {
    return {
      level: "unhealthy",
      category: "غير صحي",
      color: "#bb2938",
      advice: "قلّل النشاط الخارجي، وخصوصًا النشاط البدني الشاق.",
    };
  }
  if (aqi <= 300) {
    return {
      level: "very-unhealthy",
      category: "غير صحي جدًا",
      color: "#773b91",
      advice: "تجنّب النشاط الخارجي الطويل، وابقَ في الداخل قدر الإمكان.",
    };
  }
  return {
    level: "hazardous",
    category: "خطير",
    color: "#7e2638",
    advice: "تجنّب الخروج وأغلق النوافذ واتبع الإرشادات الصحية المحلية.",
  };
}

// أمثلة يدوية:
// weatherCodeToInfo(0) => { description: "سماء صافية", icon: "☀️" }
// formatDate("2026-10-09") => التاريخ بالعربية مع اسم اليوم
// formatTemp(21.6) => "22°"
// aqiToInfo(42) => { category: "جيد", ... }