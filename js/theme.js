function applyWeatherTheme(code, isDay) {
  let weather = "cloudy";

  if (code === 0 || code === 1) {
    weather = "clear";
  } else if (code === 45 || code === 48) {
    weather = "fog";
  } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    weather = "rain";
  } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    weather = "snow";
  } else if (code >= 95 && code <= 99) {
    weather = "storm";
  } else if (code === 2 || code === 3) {
    weather = "cloudy";
  }

  const time = Number(isDay) === 1 ? "day" : "night";
  document.body.dataset.weather = weather;
  document.body.dataset.time = time;
  return { weather, time };
}
