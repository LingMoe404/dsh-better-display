import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { StickyLane, usePublishedHeight } from '../../src/client/StickyLane.js';

function Measured({ id, property, height }: { id: string; property: string; height: number }) {
  const ref = usePublishedHeight(property);
  return <div ref={ref} id={id} style={{ height }}>{id}</div>;
}

function SummaryReader({ id, height, show }: { id: string; height: number; show: boolean }) {
  return <div data-dsh-better-display={id} id={`root-${id}`}>
    <section data-reader-turn="1" id={`turn-${id}`}>
      {show && <Measured id={`row-${id}`} property="--reader-summary-height" height={height} />}
    </section>
  </div>;
}

function App() {
  const [height, setHeight] = useState(52);
  const [show, setShow] = useState(true);
  return <>
    <button id="grow" type="button" onClick={() => setHeight(86)}>grow</button>
    <button id="drop" type="button" onClick={() => setShow(false)}>drop</button>
    <SummaryReader id="a" height={height} show={show} />
    <SummaryReader id="b" height={52} show />
    <div data-dsh-better-display="short" id="root-short">
      <section data-reader-turn="1" id="turn-short">
        <Measured id="row-short" property="--reader-status-height" height={38} />
      </section>
    </div>
    <div data-dsh-better-display="toolbar" id="root-toolbar">
      <StickyLane kind="toolbar" className="toolbarProbe">
        <button id="toolbar-button" type="button" style={{ height: 12, padding: 0, border: 0 }}>开</button>
      </StickyLane>
    </div>
    <div data-dsh-better-display="status" id="root-status">
      <section data-reader-turn="1" id="turn-status">
        <StickyLane kind="status" className="statusProbe">
          <span style={{ display: 'block', height: 12 }}>用时</span>
        </StickyLane>
      </section>
    </div>
  </>;
}

createRoot(document.getElementById('app')!).render(<App />);
