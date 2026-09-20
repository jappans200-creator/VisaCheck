// Generates downloadable "Visa Verdict" share images (Instagram Story size
// and square size) by drawing the card onto an off-screen canvas, plus
// copies a pre-written caption to the clipboard. No external libraries —
// just the browser's native Canvas API.

const THEME_COLORS = {
  deepred: ["#b91c1c", "#450a0a"],
  orange: ["#ea580c", "#7c2d12"],
  amber: ["#ca8a04", "#713f12"],
  green: ["#16a34a", "#14532d"],
};

function wrapCanvasText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const test = current ? current + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function drawVerdictCard(canvas, opts) {
  const { width, height, profile, percent, colorTier, message, sampleSize } = opts;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const scale = width / 1080; // base all sizing on the 1080px-wide design

  const [c1, c2] = THEME_COLORS[colorTier] || THEME_COLORS.amber;
  const gradient = ctx.createLinearGradient(0, 0, width * 0.3, height);
  gradient.addColorStop(0, c1);
  gradient.addColorStop(1, c2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  const cx = width / 2;
  let y = height * (height > width ? 0.16 : 0.14);

  // Kicker
  ctx.globalAlpha = 0.75;
  ctx.font = `700 ${28 * scale}px -apple-system, Helvetica, Arial, sans-serif`;
  ctx.fillText("VISA VERDICT", cx, y);
  y += 70 * scale;

  // Profile line
  ctx.globalAlpha = 0.92;
  ctx.font = `600 ${30 * scale}px -apple-system, Helvetica, Arial, sans-serif`;
  const profileLine = `${profile.nationality} · ${profile.permitType} · ${getFlagEmoji(profile.destination)} ${profile.destination}`;
  wrapCanvasText(ctx, profileLine, width * 0.82).forEach((line) => {
    ctx.fillText(line, cx, y);
    y += 42 * scale;
  });
  y += 40 * scale;

  // "YOUR ODDS:" label
  ctx.globalAlpha = 0.75;
  ctx.font = `700 ${26 * scale}px -apple-system, Helvetica, Arial, sans-serif`;
  ctx.fillText("YOUR ODDS:", cx, y);
  y += 30 * scale;

  // Huge percentage
  ctx.globalAlpha = 1;
  ctx.font = `900 ${260 * scale}px -apple-system, Helvetica, Arial, sans-serif`;
  y += 220 * scale;
  ctx.fillText(percent + "%", cx, y);
  y += 70 * scale;

  // Country message
  ctx.font = `600 ${34 * scale}px -apple-system, Helvetica, Arial, sans-serif`;
  wrapCanvasText(ctx, message, width * 0.78).forEach((line) => {
    ctx.fillText(line, cx, y);
    y += 48 * scale;
  });
  y += 30 * scale;

  // Sample size
  ctx.globalAlpha = 0.85;
  ctx.font = `500 ${24 * scale}px -apple-system, Helvetica, Arial, sans-serif`;
  ctx.fillText(`Based on ${sampleSize} real applications from people with your profile`, cx, y);

  // Footer
  ctx.globalAlpha = 0.9;
  const footerY = height - 70 * scale;
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(width * 0.25, footerY - 40 * scale);
  ctx.lineTo(width * 0.75, footerY - 40 * scale);
  ctx.stroke();
  ctx.font = `800 ${30 * scale}px -apple-system, Helvetica, Arial, sans-serif`;
  ctx.fillText("VisaCheck.", cx, footerY);
  ctx.font = `500 ${24 * scale}px -apple-system, Helvetica, Arial, sans-serif`;
  ctx.globalAlpha = 0.8;
  ctx.fillText("Know before you go", cx, footerY + 36 * scale);

  ctx.globalAlpha = 1;
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}

const SHARE_CAPTIONS = {
  deepred: (pct, dest) =>
    `Just checked my visa odds before applying 😬 ${pct}% chance for ${dest} with my profile. This tool might have just saved me €90. visacheck.io`,
  orange: (pct, dest) =>
    `${pct}% visa approval odds for ${dest} 😅 Lower than I expected. Checked on VisaCheck before wasting my application fee. visacheck.io`,
  amber: (pct, dest) =>
    `${pct}% chance of getting my ${dest} visa 🤞 Not bad but not certain. VisaCheck breaks down exactly what is affecting my odds. visacheck.io`,
  green: (pct, dest) =>
    `${pct}% visa approval odds for ${dest} ✅ Higher than I expected honestly. VisaCheck analyses your exact permit situation before you apply. visacheck.io`,
};

function getShareCaption(colorTier, percent, destination) {
  const fn = SHARE_CAPTIONS[colorTier] || SHARE_CAPTIONS.amber;
  return fn(percent, destination);
}

async function shareVerdict(opts) {
  const storyCanvas = document.createElement("canvas");
  drawVerdictCard(storyCanvas, { ...opts, width: 1080, height: 1920 });
  downloadCanvas(storyCanvas, "visacheck-verdict-story.png");

  const squareCanvas = document.createElement("canvas");
  drawVerdictCard(squareCanvas, { ...opts, width: 1080, height: 1080 });
  setTimeout(() => downloadCanvas(squareCanvas, "visacheck-verdict-square.png"), 300);

  const caption = getShareCaption(opts.colorTier, opts.percent, opts.profile.destination);
  try {
    await navigator.clipboard.writeText(caption);
    return { captionCopied: true, caption };
  } catch (err) {
    return { captionCopied: false, caption };
  }
}
