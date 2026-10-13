import { chromium, type Browser, type Page } from 'playwright';

export type WebStep =
  | { action: 'goto'; url: string }
  | { action: 'click'; selector: string }
  | { action: 'fill'; selector: string; value: string }
  | { action: 'expectText'; selector: string; text: string }
  | { action: 'expectTitle'; text: string };

export class InvalidStepsError extends Error {}
export class AssertionFailure extends Error {}

function localUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
      !url.username && !url.password;
  } catch { return false; }
}

export function parseWebSteps(raw: string): WebStep[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new InvalidStepsError('steps_must_be_json_array'); }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 30)
    throw new InvalidStepsError('steps_must_contain_1_to_30_actions');
  return parsed.map((item: unknown, index: number): WebStep => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new InvalidStepsError(`invalid_step_${index}`);
    const x = item as Record<string, unknown>;
    const str = (key: string, max = 500) => typeof x[key] === 'string' && (x[key] as string).length > 0 && (x[key] as string).length <= max;
    if (x.action === 'goto' && str('url', 1000) && localUrl(x.url as string)) return { action:'goto', url:x.url as string };
    if (x.action === 'click' && str('selector')) return { action:'click', selector:x.selector as string };
    if (x.action === 'fill' && str('selector') && typeof x.value === 'string' && x.value.length <= 1000)
      return { action:'fill', selector:x.selector as string, value:x.value };
    if (x.action === 'expectText' && str('selector') && str('text', 1000))
      return { action:'expectText', selector:x.selector as string, text:x.text as string };
    if (x.action === 'expectTitle' && str('text', 1000)) return { action:'expectTitle', text:x.text as string };
    throw new InvalidStepsError(`invalid_or_unsupported_step_${index}`);
  });
}

export async function executeWebSteps(steps: WebStep[]): Promise<string> {
  let browser: Browser | undefined;
  const log: string[] = [];
  const deadlineMs = 30_000;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const job = async () => {
      browser = await chromium.launch({ headless: true, timeout: 10_000 });
      const page: Page = await browser.newPage();
      page.setDefaultTimeout(5000);
      // Navigation is restricted to loopback for this local-only slice.
      await page.route('**/*', route => {
        const url = route.request().url();
        if (localUrl(url) || url.startsWith('data:') || url.startsWith('about:')) return route.continue();
        return route.abort();
      });
      for (const [i, step] of steps.entries()) {
        if (step.action === 'goto') await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 8000 });
        if (step.action === 'click') await page.locator(step.selector).click();
        if (step.action === 'fill') await page.locator(step.selector).fill(step.value);
        if (step.action === 'expectText') {
          const actual = await page.locator(step.selector).innerText();
          if (!actual.includes(step.text)) throw new AssertionFailure(`step_${i + 1}: expected text not found`);
        }
        if (step.action === 'expectTitle') {
          const actual = await page.title();
          if (!actual.includes(step.text)) throw new AssertionFailure(`step_${i + 1}: expected title not found`);
        }
        log.push(`step_${i + 1}: ${step.action} OK`);
      }
      return log.join('\n');
    };
    return await Promise.race([
      job(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => { void browser?.close().catch(() => {}); reject(new Error('run_timeout_30000ms')); }, deadlineMs); })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    await browser?.close().catch(() => {});
  }
}
