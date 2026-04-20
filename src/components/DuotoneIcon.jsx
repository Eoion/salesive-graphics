// Renders a HugeIcons duotone SVG inline. Icons use currentColor so they
// respond to CSS color. The opacity="0.4" on one path gives the duotone effect.
export default function DuotoneIcon({ svg, size = 16, style = {} }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={{ display: 'inline-block', flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
