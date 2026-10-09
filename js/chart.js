const TEMPERATURE_CHARTS = new WeakMap();

function drawTemperatureChart(canvas, hourly, temperatureUnit = "C") {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("عنصر الرسم البياني لدرجات الحرارة غير موجود.");
  }
  if (!Array.isArray(hourly)) {
    throw new Error("بيانات الرسم البياني لدرجات الحرارة غير صالحة.");
  }

  const points = hourly.map((hour) => {
    if (!hour || typeof hour.time !== "string" || !Number.isFinite(hour.temp)) {
      throw new Error("تحتوي بيانات الرسم البياني على قيمة غير صالحة.");
    }
    const temp = temperatureUnit === "F" ? (hour.temp * 9) / 5 + 32 : hour.temp;
    const match = hour.time.match(/T(\d{2}):(\d{2})/);
    return {
      time: match ? `${match[1]}:${match[2]}` : hour.time,
      temp,
    };
  });
  const state = TEMPERATURE_CHARTS.get(canvas) ?? { tooltipIndex: -1, clearTooltipTimer: 0 };
  state.points = points;
  state.canvas = canvas;

  if (!state.listenersAdded) {
    canvas.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      state.tooltipIndex = getNearestChartPoint(state, event);
      renderTemperatureChart(state);
    });
    canvas.addEventListener("pointerleave", () => {
      if (state.clearTooltipTimer) window.clearTimeout(state.clearTooltipTimer);
      state.tooltipIndex = -1;
      renderTemperatureChart(state);
    });
    canvas.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      state.tooltipIndex = getNearestChartPoint(state, event);
      renderTemperatureChart(state);
      announceTemperaturePoint(state, state.tooltipIndex);
      if (state.clearTooltipTimer) window.clearTimeout(state.clearTooltipTimer);
      state.clearTooltipTimer = window.setTimeout(() => {
        state.tooltipIndex = -1;
        renderTemperatureChart(state);
      }, 2500);
    });
    canvas.addEventListener("keydown", (event) => {
      let nextIndex = state.tooltipIndex < 0 ? 0 : state.tooltipIndex;
      if (event.key === "ArrowRight") nextIndex = Math.min(state.points.length - 1, nextIndex + 1);
      else if (event.key === "ArrowLeft") nextIndex = Math.max(0, nextIndex - 1);
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = state.points.length - 1;
      else return;

      event.preventDefault();
      state.tooltipIndex = nextIndex;
      renderTemperatureChart(state);
      announceTemperaturePoint(state, nextIndex);
    });
    state.listenersAdded = true;
  }

  if (!state.resizeListenerAdded) {
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => renderTemperatureChart(state), 120);
    });
    state.resizeListenerAdded = true;
  }

  TEMPERATURE_CHARTS.set(canvas, state);
  renderTemperatureChart(state);
  if (state.tooltipIndex >= 0) announceTemperaturePoint(state, state.tooltipIndex);
}

function getNearestChartPoint(state, event) {
  const { canvas, points, plot } = state;
  if (!plot || points.length === 0) return -1;
  const bounds = canvas.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  if (x < plot.left || x > plot.right) return -1;
  const ratio = (x - plot.left) / Math.max(1, plot.right - plot.left);
  return Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
}

function renderTemperatureChart(state) {
  const { canvas, points, temperatureUnit } = state;
  const bounds = canvas.getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;
  if (width <= 0 || height <= 0) return;

  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const context = canvas.getContext("2d");
  if (!context) throw new Error("تعذر تهيئة الرسم البياني على Canvas.");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const styles = getComputedStyle(canvas);
  const gridColor = styles.getPropertyValue("--chart-grid").trim();
  const lineColor = styles.getPropertyValue("--chart-line").trim();
  const pointColor = styles.getPropertyValue("--chart-point").trim();
  const labelColor = styles.getPropertyValue("--chart-label").trim();
  const fontFamily = styles.fontFamily || "sans-serif";
  const unitLabel = temperatureUnit === "F" ? "°ف" : "°م";
  const margin = { top: 34, right: 42, bottom: 42, left: 44 };
  const plot = {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
  };
  state.plot = plot;
  state.width = width;
  state.height = height;
  state.unitLabel = unitLabel;

  if (points.length === 0) {
    canvas.setAttribute("aria-label", "لا تتوفر بيانات درجات الحرارة لرسمها.");
    return;
  }

  const values = points.map((point) => point.temp);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const rawRange = maximum - minimum;
  const padding = rawRange === 0 ? Math.max(2, Math.abs(maximum) * 0.08) : rawRange * 0.15;
  const domainMin = minimum - padding;
  const domainMax = maximum + padding;
  const plotHeight = plot.bottom - plot.top;
  const plotWidth = plot.right - plot.left;
  const xAt = (index) => plot.left + (index / Math.max(1, points.length - 1)) * plotWidth;
  const yAt = (value) => plot.bottom - ((value - domainMin) / (domainMax - domainMin)) * plotHeight;

  context.font = `12px ${fontFamily}`;
  context.textBaseline = "middle";
  context.textAlign = "right";
  context.lineWidth = 1;
  context.strokeStyle = gridColor;
  context.fillStyle = labelColor;
  const tickCount = 4;
  for (let tick = 0; tick <= tickCount; tick += 1) {
    const ratio = tick / tickCount;
    const value = domainMax - ratio * (domainMax - domainMin);
    const y = plot.top + ratio * plotHeight;
    context.beginPath();
    context.moveTo(plot.left, y);
    context.lineTo(plot.right, y);
    context.stroke();
    context.fillText(`${Math.round(value)}${unitLabel}`, plot.left - 8, y);
  }

  points.forEach((point, index) => {
    if (index % 3 !== 0) return;
    const x = xAt(index);
    context.beginPath();
    context.moveTo(x, plot.top);
    context.lineTo(x, plot.bottom);
    context.stroke();
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(point.time, x, plot.bottom + 12);
  });

  const coordinates = points.map((point, index) => ({ x: xAt(index), y: yAt(point.temp) }));
  if (coordinates.length > 1) {
    context.beginPath();
    context.moveTo(coordinates[0].x, coordinates[0].y);
    for (let index = 0; index < coordinates.length - 1; index += 1) {
      const current = coordinates[index];
      const next = coordinates[index + 1];
      const controlX = (current.x + next.x) / 2;
      context.bezierCurveTo(controlX, current.y, controlX, next.y, next.x, next.y);
    }
    context.lineTo(coordinates[coordinates.length - 1].x, plot.bottom);
    context.lineTo(coordinates[0].x, plot.bottom);
    context.closePath();

    const gradient = context.createLinearGradient(0, plot.top, 0, plot.bottom);
    gradient.addColorStop(0, styles.getPropertyValue("--chart-fill-start").trim());
    gradient.addColorStop(1, styles.getPropertyValue("--chart-fill-end").trim());
    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    context.moveTo(coordinates[0].x, coordinates[0].y);
    for (let index = 0; index < coordinates.length - 1; index += 1) {
      const current = coordinates[index];
      const next = coordinates[index + 1];
      const controlX = (current.x + next.x) / 2;
      context.bezierCurveTo(controlX, current.y, controlX, next.y, next.x, next.y);
    }
    context.strokeStyle = lineColor;
    context.lineWidth = 3;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();
  }

  const minimumIndex = values.indexOf(minimum);
  const maximumIndex = values.indexOf(maximum);
  context.font = `bold 12px ${fontFamily}`;
  const extrema = minimumIndex === maximumIndex
    ? [{ index: minimumIndex, label: `أعلى وأدنى ${formatChartTemperature(maximum, unitLabel)}` }]
    : [
      { index: maximumIndex, label: `أعلى ${formatChartTemperature(maximum, unitLabel)}` },
      { index: minimumIndex, label: `أدنى ${formatChartTemperature(minimum, unitLabel)}` },
    ];
  extrema.forEach(({ index, label }) => {
    const point = coordinates[index];
    context.beginPath();
    context.arc(point.x, point.y, 5, 0, Math.PI * 2);
    context.fillStyle = pointColor;
    context.fill();
    context.strokeStyle = styles.backgroundColor || "#ffffff";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = labelColor;
    context.textAlign = point.x > width / 2 ? "right" : "left";
    context.textBaseline = point.y < plot.top + 24 ? "bottom" : "top";
    const labelX = point.x + (point.x > width / 2 ? -8 : 8);
    const labelY = point.y + (point.y < plot.top + 24 ? -7 : 7);
    context.fillText(label, labelX, labelY);
  });

  canvas.setAttribute(
    "aria-label",
    `رسم درجات الحرارة للساعات القادمة. أعلى درجة ${formatChartTemperature(maximum, unitLabel)} عند الساعة ${points[maximumIndex].time}، وأدنى درجة ${formatChartTemperature(minimum, unitLabel)} عند الساعة ${points[minimumIndex].time}.`,
  );

  if (state.tooltipIndex >= 0 && state.tooltipIndex < points.length) {
    drawTemperatureTooltip(context, state, coordinates[state.tooltipIndex], points[state.tooltipIndex]);
  }
}

function formatChartTemperature(value, unitLabel) {
  return `${new Intl.NumberFormat("ar", { maximumFractionDigits: 1 }).format(value)} ${unitLabel}`;
}

function announceTemperaturePoint(state, index) {
  if (index < 0 || index >= state.points.length) return;
  const status = document.querySelector("#hourly-chart-tooltip");
  if (!status) return;
  const point = state.points[index];
  status.textContent = `الساعة ${point.time}، درجة الحرارة ${formatChartTemperature(point.temp, state.unitLabel)}. استخدم السهمين للتنقل بين الساعات.`;
}

function drawTemperatureTooltip(context, state, point, hourly) {
  const { plot, width, height, unitLabel } = state;
  const text = `${hourly.time}  ${formatChartTemperature(hourly.temp, unitLabel)}`;
  context.font = `bold 12px ${getComputedStyle(state.canvas).fontFamily || "sans-serif"}`;
  const boxWidth = context.measureText(text).width + 20;
  const boxHeight = 32;
  const x = Math.max(4, Math.min(width - boxWidth - 4, point.x - boxWidth / 2));
  const y = point.y - boxHeight - 12 < plot.top ? point.y + 14 : point.y - boxHeight - 12;
  const styles = getComputedStyle(state.canvas);
  context.beginPath();
  context.roundRect(x, Math.max(4, Math.min(height - boxHeight - 4, y)), boxWidth, boxHeight, 8);
  context.fillStyle = styles.getPropertyValue("--chart-line").trim();
  context.fill();
  context.fillStyle = styles.getPropertyValue("--button-text").trim();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, x + boxWidth / 2, Math.max(4, Math.min(height - boxHeight - 4, y)) + boxHeight / 2);
}

const PRECIPITATION_CHARTS = new WeakMap();

function drawPrecipitationChart(canvas, daily) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("عنصر رسم احتمال الهطول غير موجود.");
  }
  if (!Array.isArray(daily)) {
    throw new Error("بيانات رسم احتمال الهطول غير صالحة.");
  }

  const points = daily.map((day) => {
    if (!day || typeof day.date !== "string"
      || (day.rainChance !== null && !Number.isFinite(day.rainChance))) {
      throw new Error("تحتوي بيانات احتمال الهطول على قيمة غير صالحة.");
    }
    return {
      label: new Intl.DateTimeFormat("ar", { weekday: "short" })
        .format(new Date(`${day.date}T12:00:00`)),
      value: day.rainChance === null ? null : Math.max(0, Math.min(100, day.rainChance)),
    };
  });
  const state = PRECIPITATION_CHARTS.get(canvas) ?? { tooltipIndex: -1, clearTooltipTimer: 0 };
  state.canvas = canvas;
  state.points = points;

  if (!state.listenersAdded) {
    canvas.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      state.tooltipIndex = getNearestPrecipitationPoint(state, event);
      renderPrecipitationChart(state);
    });
    canvas.addEventListener("pointerleave", () => {
      if (state.clearTooltipTimer) window.clearTimeout(state.clearTooltipTimer);
      state.tooltipIndex = -1;
      renderPrecipitationChart(state);
    });
    canvas.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      state.tooltipIndex = getNearestPrecipitationPoint(state, event);
      renderPrecipitationChart(state);
      announcePrecipitationPoint(state, state.tooltipIndex);
      if (state.clearTooltipTimer) window.clearTimeout(state.clearTooltipTimer);
      state.clearTooltipTimer = window.setTimeout(() => {
        state.tooltipIndex = -1;
        renderPrecipitationChart(state);
      }, 2500);
    });
    canvas.addEventListener("keydown", (event) => {
      if (!state.points.length) return;
      let nextIndex = state.tooltipIndex < 0 ? 0 : state.tooltipIndex;
      if (event.key === "ArrowRight") nextIndex = Math.min(state.points.length - 1, nextIndex + 1);
      else if (event.key === "ArrowLeft") nextIndex = Math.max(0, nextIndex - 1);
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = state.points.length - 1;
      else return;
      event.preventDefault();
      state.tooltipIndex = nextIndex;
      renderPrecipitationChart(state);
      announcePrecipitationPoint(state, nextIndex);
    });
    state.listenersAdded = true;
  }

  if (!state.resizeListenerAdded) {
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => renderPrecipitationChart(state), 120);
    });
    state.resizeListenerAdded = true;
  }

  PRECIPITATION_CHARTS.set(canvas, state);
  renderPrecipitationChart(state);
  if (state.tooltipIndex >= 0) announcePrecipitationPoint(state, state.tooltipIndex);
}

function getNearestPrecipitationPoint(state, event) {
  const { canvas, points, plot } = state;
  if (!plot || points.length === 0) return -1;
  const bounds = canvas.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  if (x < plot.left || x > plot.right) return -1;
  const step = plot.width / points.length;
  return Math.max(0, Math.min(points.length - 1, Math.floor((x - plot.left) / step)));
}

function renderPrecipitationChart(state) {
  const { canvas, points } = state;
  const bounds = canvas.getBoundingClientRect();
  const width = bounds.width;
  const height = bounds.height;
  if (width <= 0 || height <= 0) return;

  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const context = canvas.getContext("2d");
  if (!context) throw new Error("تعذر تهيئة رسم احتمال الهطول على Canvas.");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const styles = getComputedStyle(canvas);
  const gridColor = styles.getPropertyValue("--chart-grid").trim();
  const labelColor = styles.getPropertyValue("--chart-label").trim();
  const lowColor = styles.getPropertyValue("--precipitation-low").trim();
  const highColor = styles.getPropertyValue("--precipitation-high").trim();
  const fontFamily = styles.fontFamily || "sans-serif";
  const margin = { top: 30, right: 20, bottom: 42, left: 38 };
  const plot = {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
    width: width - margin.left - margin.right,
  };
  state.plot = plot;
  state.width = width;
  state.height = height;

  context.font = `12px ${fontFamily}`;
  context.textAlign = "right";
  context.textBaseline = "middle";
  context.lineWidth = 1;
  context.strokeStyle = gridColor;
  context.fillStyle = labelColor;
  [0, 25, 50, 75, 100].forEach((value) => {
    const y = plot.bottom - (value / 100) * (plot.bottom - plot.top);
    context.beginPath();
    context.moveTo(plot.left, y);
    context.lineTo(plot.right, y);
    context.stroke();
    context.fillText(`${value}٪`, plot.left - 6, y);
  });

  const step = plot.width / Math.max(1, points.length);
  const barWidth = Math.min(34, step * 0.56);
  const barPoints = points.map((point, index) => {
    const centerX = plot.left + step * (index + 0.5);
    const barHeight = point.value === null ? 0 : (point.value / 100) * (plot.bottom - plot.top);
    const top = plot.bottom - barHeight;
    if (point.value !== null) {
      context.fillStyle = point.value >= 60 ? highColor : lowColor;
      context.fillRect(centerX - barWidth / 2, top, barWidth, barHeight);
    } else {
      context.strokeStyle = gridColor;
      context.setLineDash([3, 3]);
      context.beginPath();
      context.moveTo(centerX - barWidth / 2, plot.bottom - 2);
      context.lineTo(centerX + barWidth / 2, plot.bottom - 2);
      context.stroke();
      context.setLineDash([]);
    }

    context.fillStyle = labelColor;
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText(point.value === null ? "—" : `${Math.round(point.value)}٪`, centerX, Math.max(plot.top - 2, top - 5));
    context.textBaseline = "top";
    context.fillText(point.label, centerX, plot.bottom + 10);
    return { x: centerX, y: point.value === null ? plot.bottom : top };
  });

  const available = points.filter((point) => point.value !== null);
  if (!available.length) {
    canvas.setAttribute("aria-label", "لا تتوفر بيانات احتمال الهطول للأيام القادمة.");
  } else {
    const max = available.reduce((best, point) => point.value > best.value ? point : best);
    const min = available.reduce((best, point) => point.value < best.value ? point : best);
    canvas.setAttribute(
      "aria-label",
      `رسم أعمدة لاحتمال الهطول للأيام القادمة. أعلى احتمال ${Math.round(max.value)}٪ يوم ${max.label}، وأدنى احتمال ${Math.round(min.value)}٪ يوم ${min.label}.`,
    );
  }

  if (state.tooltipIndex >= 0 && state.tooltipIndex < points.length) {
    drawPrecipitationTooltip(context, state, barPoints[state.tooltipIndex], points[state.tooltipIndex]);
  }
}

function announcePrecipitationPoint(state, index) {
  if (index < 0 || index >= state.points.length) return;
  const point = state.points[index];
  const status = document.querySelector("#precipitation-chart-tooltip");
  if (!status) return;
  status.textContent = point.value === null
    ? `${point.label}: بيانات احتمال الهطول غير متوفرة.`
    : `${point.label}: احتمال الهطول ${Math.round(point.value)}٪. استخدم السهمين للتنقل بين الأيام.`;
}

function drawPrecipitationTooltip(context, state, pointPosition, point) {
  const { width, height, plot } = state;
  const styles = getComputedStyle(state.canvas);
  const valueText = point.value === null ? "غير متوفر" : `${Math.round(point.value)}٪`;
  const text = `${point.label}: ${valueText}`;
  context.font = `bold 12px ${styles.fontFamily || "sans-serif"}`;
  const boxWidth = context.measureText(text).width + 20;
  const boxHeight = 32;
  const x = Math.max(4, Math.min(width - boxWidth - 4, pointPosition.x - boxWidth / 2));
  const above = pointPosition.y - boxHeight - 12 >= plot.top;
  const y = above ? pointPosition.y - boxHeight - 12 : pointPosition.y + 12;
  const boundedY = Math.max(4, Math.min(height - boxHeight - 4, y));
  context.beginPath();
  context.roundRect(x, boundedY, boxWidth, boxHeight, 8);
  context.fillStyle = styles.getPropertyValue("--chart-line").trim();
  context.fill();
  context.fillStyle = styles.getPropertyValue("--button-text").trim();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, x + boxWidth / 2, boundedY + boxHeight / 2);
}
