import React from 'react'
import logo from './logo.svg'
import './App.css'

const useEventListener = <K extends keyof ElementEventMap>(
  target: Element, event: K,
  cb: (this: Element, ev: ElementEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions
) => {
  React.useEffect(() => {
    target.addEventListener(event, cb, options);
    return () => target.removeEventListener(event, cb, options);
  }, [cb]);
};

const useWindowEventListener = <K extends keyof WindowEventMap>(
  event: K,
  cb: (this: Window, ev: WindowEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions
) => {
  useEventListener(window as unknown as any, event as unknown as any, cb as unknown as any, options);
};

const Cards: React.FC<{coords: (readonly [number, number])[], onClick: () => void}> =
({coords, onClick}) => {
  return <>
    {coords.map(([x, y], i) => <div style={{position: "absolute", left: `${x}px`, top: `${y}px`, display: "flex"}} onClick={onClick} key={i}>{i}</div>)}
  </>;
}

const getMouseXy = (ev: MouseEvent) => {
  return [ev.clientX, ev.clientY] as const;
};

const useMouseMove = (pos: readonly [number, number], setPos: (p: readonly [number, number]) => void) => {
  const [x, y] = pos;
  const [[dx, dy], setD] = React.useState([0 as number, 0 as number] as const);
  const [s, setS] = React.useState<null | readonly [number, number]>(null);
  const onMouseDown = React.useCallback((ev: MouseEvent) => {
    setS(getMouseXy(ev));
  }, []);
  const onMouseUp = React.useCallback((ev: MouseEvent) => {
    if (s == null) return;
    setS(null);
    setD([0, 0]);
    setPos([x + dx, y + dy]);
  }, [x, y, dx, dy, s, setPos]);
  const onMouseMove = React.useCallback((ev: MouseEvent) => {
    if (s == null) return;
    const [xx, yy] = getMouseXy(ev);
    const [sx, sy] = s;
    setD([xx - sx, yy - sy]);
  }, [s]);
  return [x + dx, y + dy, onMouseDown, onMouseMove, onMouseUp] as const;
}

const Player: React.FC<{value: Player, index: number, onClick?: (i: number) => void, update: (i: number, f: (p: Player) => Player) => void}> = ({value: p, onClick, index, update}) => {
  const [x, y, onMouseDown, onMouseMove, onMouseUp] = useMouseMove([p.x, p.y], ([x, y]) => update(index, (p) => ({...p, x, y})));
  useWindowEventListener("mousemove", onMouseMove);
  useWindowEventListener("mouseup", onMouseUp);
  const [confirm, setConfirm] = React.useState(false);
  React.useEffect(() => {
    if (onClick != null) setConfirm(false);
  }, [onClick]);
  return <div
    style={{
      position: "absolute",
      left: `${x}px`,
      top: `${y}px`,
      display: "flex",
      flexDirection: "column",
      border: "1px solid black",
      background: "white",
    }}
    onMouseDown={onClick == null ? (e) => onMouseDown(e.nativeEvent) : undefined}
    onClick={onClick == null ? undefined : () => onClick(index)}
  >
    <input value={p.name} onChange={(e) => update(index, (p) => ({...p, name: e.target.value}))} />
    <div style={{display: "flex"}}>{(p.cards.length === 0 ? ["No cards"] : p.cards.map(c => "" + c)).map((c, i) => <div key={i} style={{margin: "5px"}}>{c}</div>)}</div>
    <button disabled={onClick != null} onClick={() => confirm ? update(index, (p) => ({...p, hidden: true})) : setConfirm(true)}>{confirm ? "Really DNF?" : "DNF"}</button>
    <button disabled={onClick != null} onClick={() => update(index, (p) => ({...p, cards: []}))}>Clear cards</button>
  </div>;
};

const Players: React.FC<{value: Player[], onClick?: (i: number) => void, update: (i: number, f: (p: Player) => Player) => void}> = ({value, ...props}) => {
  return <>
    {value.map((p, i) => p.hidden ? null : <Player key={i} value={p} index={i} {...props} />)}
  </>;
};

interface Player {
  name: string;
  cards: number[];
  x: number;
  y: number;
  hidden?: boolean;
}

function App() {
  const [mode, setMode] = React.useState("drag");
  const coords = React.useRef<(readonly [number,number])[]>([]);
  const [coordsLength, setCoordsLength] = React.useState(0);
  const [drawn, setDrawn] = React.useState<number | null>(null);
  const [players, setPlayers] = React.useState<Player[]>([]);
  const drawTo = React.useCallback(([x, y]: readonly [number, number]) => {
    coords.current.push([x, y]);
    setCoordsLength(coords.current.length);
  }, []);
  useWindowEventListener("mousedown", React.useCallback((ev: MouseEvent) => {
    if (ev.target instanceof Element && ev.target.tagName === "BUTTON") return;
    if (mode === "drag") {
      setMode("dragging");
      coords.current = [];
      drawTo(getMouseXy(ev));
      ev.preventDefault();
    }
    if (mode === "placePlayer") {
      const [x, y] = getMouseXy(ev);
      setPlayers([...players, {name: "Player " + (players.length + 1), cards: [], x, y}]);
      setMode("draw");
    }
  }, [mode]));
  useWindowEventListener("mousemove", React.useCallback((ev: MouseEvent) => {
    if (mode === "dragging") {
      drawTo(getMouseXy(ev));
    }
  }, [mode]));
  useWindowEventListener("mouseup", React.useCallback((ev: MouseEvent) => {
    if (mode === "dragging") {
      drawTo(getMouseXy(ev));
      setMode("draw");
    }
  }, [mode]));
  const drawCard = React.useCallback(() => {
    setDrawn((Math.random() * 52)|0);
    setMode("choose");
  }, [])
  const cardClick = React.useCallback(() => {
    if (mode === "draw") {
      drawCard();
    }
  }, [mode, drawCard]);

  return <>
    <Cards coords={coords.current} onClick={cardClick} />
    <Players
      value={players}
      update={(i, p) => setPlayers((ps) => [...ps.slice(0, i), p(ps[i]), ...ps.slice(i + 1)])}
      onClick={mode !== "choose" ? undefined : (i) => {
        if (drawn != null) {
          setPlayers((ps) => [...ps.slice(0, i), {...ps[i], cards: [...ps[i].cards, drawn]}, ...ps.slice(i + 1)]);
          setDrawn(null);
        }
        setMode("draw");
      }}
      />
    <div>Currently drawn card: {drawn}</div>
    <div><button
      onClick={() => setMode((m) => m === "drag" ? "draw" : "drag")}
      disabled={!(mode === "drag" && coords.current.length > 0 || mode === "draw")}
    >{(mode === "drag" || mode === "dragging") ? "Drag the new cards" : "Shuffle deck"}</button></div>
    <div><button
      onClick={() => setMode((m) => m === "draw" ? "placePlayer" : "draw")}
      disabled={!(mode === "draw" || mode === "placePlayer")}
    >{mode === "placePlayer" ? "Click the new player's location!" : "Add player"}</button></div>
  </>;
}

export default App
