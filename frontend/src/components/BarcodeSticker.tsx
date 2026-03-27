import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export type StickerItem = {
  barcode: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  condition: string;
  price: number;
};

function SingleSticker({ item }: { item: StickerItem }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && item.barcode) {
      try {
        JsBarcode(svgRef.current, item.barcode, {
          format: 'CODE128',
          width: 1.5,
          height: 28,
          displayValue: true,
          fontSize: 9
        });
      } catch (e) {
        console.warn('Barcode render failed', e);
      }
    }
  }, [item.barcode]);

  return (
    <div className="barcode-sticker" style={{ width: '50mm', height: '25mm', padding: '2mm', border: '1px solid #ddd', boxSizing: 'border-box', margin: 2 }}>
      <div style={{ fontSize: 9, lineHeight: 1.2 }}>
        <div style={{ fontWeight: 600 }}>{item.brand} {item.model}</div>
        <div>{item.storage} {item.color}</div>
        <div>{item.condition}</div>
      </div>
      <svg ref={svgRef} style={{ height: 18, marginTop: 2 }} />
      <div style={{ fontWeight: 600, fontSize: 10, marginTop: 2 }}>Price: ${item.price.toFixed(0)}</div>
    </div>
  );
}

export function BarcodeStickerSheet({ items }: { items: StickerItem[] }) {
  const expanded: StickerItem[] = [];
  items.forEach((item) => expanded.push(item));
  return (
    <div className="barcode-sticker-sheet" style={{ padding: 8, fontFamily: 'sans-serif', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {expanded.map((item, i) => (
        <SingleSticker key={i} item={item} />
      ))}
    </div>
  );
}
