import { useRef, useEffect, useState } from 'react';

const TYPE_COLOR = {
  text:  '#60a5fa',
  image: '#c084fc',
  color: '#0D65D9',
  icon:  '#4ade80',
  shape: '#0D65D9',
  group: '#818cf8',
};

function getRectRelative(el, container) {
  const er = el.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  return {
    left:   er.left   - cr.left,
    top:    er.top    - cr.top,
    width:  er.width,
    height: er.height,
  };
}

// Walk up the DOM from el until we hit the SVG root, collecting nodes that match our index
function buildAncestry(el, svgEl, nodeIndex) {
  const chain = [];
  let cur = el;
  while (cur && cur !== svgEl.parentElement) {
    const id = cur.getAttribute?.('id');
    if (id && nodeIndex[id]) chain.unshift(nodeIndex[id]);
    cur = cur.parentElement;
  }
  return chain;
}

// Find the deepest ancestor of `el` (including itself) that exists in our node index
function resolveNode(el, svgEl, nodeIndex) {
  let cur = el;
  while (cur && cur !== svgEl) {
    const id = cur.getAttribute?.('id');
    if (id && nodeIndex[id]) return { node: nodeIndex[id], el: cur };
    cur = cur.parentElement;
  }
  return null;
}

export default function SVGCanvas({ svgString, nodes, selectedId, mappings, onSelectNode, leftActions, rightActions }) {
  const outerRef     = useRef();
  const containerRef = useRef();
  const svgRef       = useRef();

  const [scale,   setScale]   = useState(1);
  const [svgSize, setSvgSize] = useState({ width: 800, height: 600 });
  const [fitted,  setFitted]  = useState(false);

  // Hover state
  const [hoverRect,    setHoverRect]    = useState(null);
  const [hoverNode,    setHoverNode]    = useState(null);
  const [ancestry,     setAncestry]     = useState([]);
  const [selectedRect, setSelectedRect] = useState(null);

  // Build a fast id→node lookup
  const nodeIndex = Object.fromEntries(nodes.map(n => [n.id, n]));

  // --- SVG injection + direct event wiring ---
  useEffect(() => {
    if (!svgString || !containerRef.current) return;
    const container = containerRef.current;
    const parser = new DOMParser();
    const doc    = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl  = doc.querySelector('svg');
    if (!svgEl) return;

    svgEl.style.width   = '100%';
    svgEl.style.height  = '100%';
    svgEl.style.display = 'block';
    svgEl.style.cursor  = 'crosshair';
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Ensure every child can receive pointer events
    svgEl.style.pointerEvents = 'all';

    const existing = container.querySelector('svg');
    if (existing) container.removeChild(existing);
    container.appendChild(svgEl);
    svgRef.current = svgEl;

    const vb = svgEl.getAttribute('viewBox');
    if (vb) {
      const parts = vb.split(/[\s,]+/);
      const w = parseFloat(parts[2]);
      const h = parseFloat(parts[3]);
      if (w && h) setSvgSize({ width: w, height: h });
    }

    setHoverRect(null);
    setHoverNode(null);
    setSelectedRect(null);

    // Attach events directly to the SVG so event.target is the real element
    svgEl.addEventListener('mousemove',  onSvgMouseMove);
    svgEl.addEventListener('mouseleave', onSvgMouseLeave);
    svgEl.addEventListener('click',      onSvgClick);

    return () => {
      svgEl.removeEventListener('mousemove',  onSvgMouseMove);
      svgEl.removeEventListener('mouseleave', onSvgMouseLeave);
      svgEl.removeEventListener('click',      onSvgClick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgString]);

  // --- Scale via ResizeObserver on stable outer wrapper ---
  useEffect(() => {
    if (!outerRef.current) return;
    const observer = new ResizeObserver(() => {
      const { width, height } = outerRef.current.getBoundingClientRect();
      if (!width || !height) return;
      setScale(Math.min(width / svgSize.width, height / svgSize.height) * 0.9);
      setFitted(true);
    });
    observer.observe(outerRef.current);
    return () => observer.disconnect();
  }, [svgSize]);

  // --- Update selectedRect when selectedId changes ---
  useEffect(() => {
    if (!selectedId || !svgRef.current || !containerRef.current) {
      setSelectedRect(null);
      return;
    }
    const el = svgRef.current.getElementById(selectedId);
    if (!el) { setSelectedRect(null); return; }
    // slight delay to let layout settle after scale change
    const t = setTimeout(() => {
      try { setSelectedRect(getRectRelative(el, containerRef.current)); }
      catch { setSelectedRect(null); }
    }, 60);
    return () => clearTimeout(t);
  }, [selectedId, scale]);

  // Stable refs so SVG event listeners never go stale
  const nodeIndexRef    = useRef({});
  const onSelectNodeRef = useRef(onSelectNode);
  useEffect(() => { nodeIndexRef.current    = nodeIndex;    });
  useEffect(() => { onSelectNodeRef.current = onSelectNode; });

  function onSvgMouseMove(e) {
    const container = containerRef.current;
    if (!container) return;
    // event.target is the actual SVG element under the cursor
    const resolved = resolveNode(e.target, svgRef.current, nodeIndexRef.current);
    if (!resolved) {
      setHoverRect(null); setHoverNode(null); setAncestry([]); return;
    }
    try {
      setHoverRect(getRectRelative(resolved.el, container));
      setHoverNode(resolved.node);
      setAncestry(buildAncestry(resolved.el, svgRef.current, nodeIndexRef.current));
    } catch {
      setHoverRect(null);
    }
  }

  function onSvgMouseLeave() {
    setHoverRect(null); setHoverNode(null); setAncestry([]);
  }

  function onSvgClick(e) {
    const resolved = resolveNode(e.target, svgRef.current, nodeIndexRef.current);
    if (resolved) onSelectNodeRef.current(resolved.node.id);
  }

  const isHoveringSameAsSelected = hoverNode?.id === selectedId;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{
        padding: '0 10px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10, height: 36,
      }}>
        {leftActions}
        
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
          {svgSize.width} × {svgSize.height}
        </span>
        <span style={{ width: 1, height: 12, background: 'var(--border)' }} />

        {/* Hover info */}
        {hoverNode && !isHoveringSameAsSelected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
              &lt;{hoverNode.tag}&gt;
            </span>
            {hoverNode.rawId && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
                #{hoverNode.rawId}
              </span>
            )}
            <span style={{
              fontSize: 10, padding: '1px 5px', borderRadius: 3,
              background: `${TYPE_COLOR[hoverNode.type] || '#fff'}20`,
              color: TYPE_COLOR[hoverNode.type] || 'var(--text-muted)',
              fontFamily: 'DM Mono, monospace',
            }}>{hoverNode.type}</span>
          </div>
        ) : selectedId ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>selected</span>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'DM Mono, monospace' }}>
              #{selectedId}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Hover to inspect · click to select
          </span>
        )}

        <div style={{ flex: 1 }} />
        {rightActions}
      </div>

      {/* Canvas area */}
      <div
        ref={outerRef}
        className="grid-bg"
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative',
          opacity: fitted ? 1 : 0, transition: 'opacity 0.2s ease-in-out'
        }}
      >
        {/* SVG + overlays wrapper */}
        <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>

          {/* SVG host */}
          <div
            ref={containerRef}
            style={{
              width:  svgSize.width  * scale,
              height: svgSize.height * scale,
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              position: 'relative',
              background: '#fff',
              display: 'block',
            }}
          />


          {/* Hover highlight */}
          {hoverRect && hoverNode && !isHoveringSameAsSelected && (
            <div style={{
              position: 'absolute',
              left: hoverRect.left, top: hoverRect.top,
              width: hoverRect.width, height: hoverRect.height,
              outline: `1.5px solid ${TYPE_COLOR[hoverNode.type] || 'rgba(255,255,255,0.5)'}`,
              background: `${TYPE_COLOR[hoverNode.type] || '#fff'}10`,
              pointerEvents: 'none',
              zIndex: 30,
              transition: 'all 0.05s',
            }}>
              {/* Element label chip — top-left of the highlight */}
              <div style={{
                position: 'absolute',
                top: hoverRect.top > 24 ? -22 : 4,
                left: 0,
                background: TYPE_COLOR[hoverNode.type] || '#555',
                color: '#000',
                fontSize: 10,
                fontFamily: 'DM Mono, monospace',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: 3,
                whiteSpace: 'nowrap',
                lineHeight: 1.5,
                pointerEvents: 'none',
                zIndex: 40,
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}>
                {hoverNode.rawId || hoverNode.id}
                {hoverNode.text && (
                  <span style={{ opacity: 0.7, marginLeft: 4 }}>"{hoverNode.text.slice(0, 18)}{hoverNode.text.length > 18 ? '…' : ''}"</span>
                )}
                {hoverNode.fill && !hoverNode.text && (
                  <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: hoverNode.fill, border: '1px solid rgba(0,0,0,0.3)' }} />
                    {hoverNode.fill}
                  </span>
                )}
              </div>

              {/* Corner resize handles (cosmetic, like Figma) */}
              {[
                { top: -3, left: -3 },
                { top: -3, right: -3 },
                { bottom: -3, left: -3 },
                { bottom: -3, right: -3 },
              ].map((pos, i) => (
                <div key={i} style={{
                  position: 'absolute', width: 5, height: 5,
                  border: `1.5px solid ${TYPE_COLOR[hoverNode.type] || '#fff'}`,
                  background: 'var(--bg-base)',
                  ...pos,
                  pointerEvents: 'none',
                }} />
              ))}
            </div>
          )}

          {/* Selected highlight */}
          {selectedRect && selectedId && (
            <div style={{
              position: 'absolute',
              left: selectedRect.left, top: selectedRect.top,
              width: selectedRect.width, height: selectedRect.height,
              outline: '2px solid var(--accent)',
              background: 'rgba(13,101,217,0.08)',
              pointerEvents: 'none',
              zIndex: 25,
              animation: 'pulse-ring 2s ease infinite',
            }}>
              {/* Selected label */}
              <div style={{
                position: 'absolute',
                top: selectedRect.top > 24 ? -22 : 4,
                left: 0,
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 10,
                fontFamily: 'DM Mono, monospace',
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 3,
                whiteSpace: 'nowrap',
                lineHeight: 1.5,
                pointerEvents: 'none',
                zIndex: 40,
                boxShadow: '0 2px 8px rgba(13,101,217,0.4)',
              }}>
                {selectedId}
                {mappings[selectedId] && (
                  <span style={{ opacity: 0.8, marginLeft: 5 }}>→ {mappings[selectedId].fieldKey}</span>
                )}
              </div>
              {/* Selected corners */}
              {[
                { top: -3, left: -3 },
                { top: -3, right: -3 },
                { bottom: -3, left: -3 },
                { bottom: -3, right: -3 },
              ].map((pos, i) => (
                <div key={i} style={{
                  position: 'absolute', width: 6, height: 6,
                  background: 'var(--accent)',
                  ...pos, pointerEvents: 'none',
                }} />
              ))}
            </div>
          )}

          {/* Mapped field dots on unmapped-but-mapped elements */}
          {Object.keys(mappings).map(nodeId => {
            if (nodeId === selectedId) return null;
            const el = svgRef.current?.getElementById(nodeId);
            if (!el || !containerRef.current) return null;
            try {
              const r = getRectRelative(el, containerRef.current);
              if (r.width < 2 && r.height < 2) return null;
              return (
                <div key={nodeId} style={{
                  position: 'absolute',
                  left: r.left, top: r.top, width: r.width, height: r.height,
                  outline: '1px dashed rgba(13,101,217,0.35)',
                  pointerEvents: 'none', zIndex: 15,
                }}>
                  <div style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--accent)', border: '1.5px solid var(--bg-base)',
                    zIndex: 16,
                  }} />
                </div>
              );
            } catch { return null; }
          })}
        </div>

        {/* Breadcrumb ancestry bar — fixed at bottom of canvas */}
        {ancestry.length > 1 && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 0,
            background: 'rgba(10,10,12,0.92)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8, padding: '4px 8px',
            backdropFilter: 'blur(8px)',
            zIndex: 50, pointerEvents: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}>
            {ancestry.map((n, i) => (
              <span key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {i > 0 && <span style={{ color: 'var(--text-muted)', padding: '0 4px', fontSize: 11 }}>›</span>}
                <span style={{
                  fontSize: 11, fontFamily: 'DM Mono, monospace',
                  color: i === ancestry.length - 1
                    ? (TYPE_COLOR[n.type] || 'var(--text-primary)')
                    : 'var(--text-muted)',
                  fontWeight: i === ancestry.length - 1 ? 600 : 400,
                }}>
                  {n.rawId || n.id}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
