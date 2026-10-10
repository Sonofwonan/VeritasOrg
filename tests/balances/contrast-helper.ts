import { expect, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";

/** Measure rendered colors, including alpha and ancestor backgrounds, not class names. */
export async function assertReadable(page: Page, selector: string, info: TestInfo, name: string, includeInactive = false) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(animation =>
      Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))
      .map(animation => animation.finished.catch(() => undefined)));
  });
  const records = await page.evaluate(({ scope, includeInactive }) => {
    const parse = (value: string) => {
      if (!/^rgba?\(/.test(value)) throw new Error(`Unsupported computed color: ${value}`);
      const values = value.match(/[\d.]+/g)!.map(Number);
      return [values[0], values[1], values[2], values[3] ?? 1];
    };
    const blend = (front: number[], back: number[]) =>
      front.slice(0, 3).map((channel, index) => channel * front[3] + back[index] * (1 - front[3]));
    const luminance = (rgb: number[]) => rgb.reduce((sum, channel, index) => {
      const s = channel / 255;
      return sum + [0.2126, 0.7152, 0.0722][index] * (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
    }, 0);
    const ratio = (a: number[], b: number[]) => {
      const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const seen = new Set<Node>();
    const results: { text: string; color: string; background: number[]; ratio: number; required: number }[] = [];
    for (const root of document.querySelectorAll(scope)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const element = node.parentElement!;
        if (seen.has(node) || !node.textContent?.trim() || /^["'·•—–…]$/.test(node.textContent.trim()) ||
          element.closest("svg,script,style,.sr-only,[inert],[hidden],[aria-hidden=true]") ||
          (!includeInactive && element.closest("[disabled],[aria-disabled=true]")) ||
          !element.getClientRects().length) continue;
        seen.add(node);
        const chain: Element[] = [];
        for (let parent: Element | null = element; parent; parent = parent.parentElement) chain.unshift(parent);
        const styles = chain.map(parent => getComputedStyle(parent));
        if (styles.some(style => style.display === "none" || style.visibility === "hidden")) continue;
        const opacity = styles.reduce((product, style) => product * Number(style.opacity), 1);
        if (opacity === 0) continue;
        let backgrounds = [[255, 255, 255]];
        for (const [index, style] of styles.entries()) {
          if (style.backgroundClip !== "text")
            backgrounds = backgrounds.map(back => blend(parse(style.backgroundColor), back));
          if (style.backgroundImage !== "none" && style.backgroundClip !== "text") {
            const stops = style.backgroundImage.match(/rgba?\([^)]*\)/g);
            if (!stops?.length || /url\(/.test(style.backgroundImage))
              throw new Error(`Unsupported text background: ${style.backgroundImage}`);
            // Check the least favorable gradient stop, not a convenient one.
            backgrounds = backgrounds.flatMap(back => stops.map(stop => blend(parse(stop), back)));
          }
          // Decorative absolute siblings (video, image, scrim, gradient) paint
          // behind the relative text layer, despite not being text ancestors.
          const textBounds = element.getBoundingClientRect();
          for (const sibling of chain[index].children) {
            if (sibling.contains(element) || sibling.textContent?.trim()) continue;
            const paint = getComputedStyle(sibling);
            const bounds = sibling.getBoundingClientRect();
            if (paint.position !== "absolute" || paint.display === "none" ||
              bounds.left > textBounds.left || bounds.right < textBounds.right ||
              bounds.top > textBounds.top || bounds.bottom < textBounds.bottom) continue;
            const alpha = Number(paint.opacity);
            if (sibling.tagName === "VIDEO" || sibling.tagName === "IMG" || /url\(/.test(paint.backgroundImage)) {
              // Unknown media can be bright or dark. Neither convenient frame
              // nor an arbitrary placeholder image is treated as evidence.
              backgrounds = backgrounds.flatMap(back =>
                [[255,255,255,alpha],[0,0,0,alpha]].map(front => blend(front,back)));
            } else {
              const solid = parse(paint.backgroundColor);
              solid[3] *= alpha;
              backgrounds = backgrounds.map(back => blend(solid,back));
              if (paint.backgroundImage !== "none") {
                const stops = paint.backgroundImage.match(/rgba?\([^)]*\)/g);
                if (!stops?.length) throw new Error(`Unsupported overlay: ${paint.backgroundImage}`);
                backgrounds = backgrounds.flatMap(back => stops.map(stop => {
                  const front=parse(stop); front[3]*=alpha; return blend(front,back);
                }));
              }
            }
          }
        }
        const style = styles.at(-1)!;
        const foregrounds = style.backgroundClip === "text"
          ? style.backgroundImage.match(/rgba?\([^)]*\)/g)?.map(parse) ?? [parse(style.backgroundColor)]
          : [parse(style.color)];
        foregrounds.forEach(foreground => { foreground[3] *= opacity; });
        const measured = backgrounds.flatMap(back => foregrounds.map(foreground =>
          ({ back, ratio: ratio(blend(foreground, back), back) })))
          .sort((a, b) => a.ratio - b.ratio)[0];
        const size = Number.parseFloat(style.fontSize);
        const required = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
        results.push({ text: node.textContent.trim().slice(0, 100), color: style.color,
          background: measured.back, ratio: measured.ratio, required });
      }
    }
    return results;
  }, { scope: selector, includeInactive });
  expect(records.length, `No text measured in ${selector}`).toBeGreaterThan(0);
  const evidencePath = info.outputPath(`${name}.json`);
  await writeFile(evidencePath, JSON.stringify(records, null, 2));
  await info.attach(name, { path: evidencePath, contentType: "application/json" });
  const failures = records.filter(record => record.ratio + 0.01 < record.required);
  expect.soft(failures, `Low-contrast rendered text: ${JSON.stringify(failures.slice(0, 16), null, 2)}`).toEqual([]);
}

export async function assertContained(page: Page, selector: string) {
  const width = page.viewportSize()!.width;
  await expect.poll(() => page.locator(selector).evaluate((element, viewportWidth) => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= viewportWidth + 0.5;
  }, width)).toBe(true);
}
