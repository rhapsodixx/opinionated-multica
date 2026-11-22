export function showBanner(stream) {
  stream.write("\n       .------.\n      /  o  o  \\\n     |    __    |\n      \\  '--'  /\n       '------'\n  POTATO / runner setup\n\n");
}
export function createProgress(stream, { animate = Boolean(stream.isTTY) } = {}) {
  return { start(label) {
    if (!animate || !stream.isTTY) {
      stream.write(`${label}...\n`);
      return error => stream.write(`${error ? 'FAILED' : 'OK'}: ${label}\n`);
    }
    const frames = ['(o_o)', '(-_-)', '(^_^)', '(o_o)']; let frame = 0;
    const draw = () => stream.write(`\r\x1b[2K${frames[frame++ % frames.length]} ${label}`);
    stream.write('\x1b[?25l'); draw();
    const timer = setInterval(draw, 120); timer.unref();
    return error => { clearInterval(timer); stream.write(`\r\x1b[2K${error ? 'FAILED' : 'OK'}: ${label}\n\x1b[?25h`); };
  } };
}
