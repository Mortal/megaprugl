import React from 'react';
import * as Game from './Game';
import './App.css';
import { onSnapshot } from "mobx-state-tree";
import { observer } from "mobx-react-lite";
import { cards } from './Cards';

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

const Card: React.FC<{value: number}> = ({value}) => {
    return <div style={{display: "inline-flex", width: "100px"}}>{cards[value]}</div>
};

const Cards: React.FC<{coords: (readonly [number, number])[], onClick: () => void}> =
({coords, onClick}) => {
    const w = 100;
    return <>
        {coords.map(([x, y], i) =>
        <div style={{
            position: "absolute",
            left: `${x-w/2}px`,
            top: `${y-w*1.5/2}px`,
            display: "flex",
            width: `${w}px`,
            height: `${w*1.5}px`,
        }} onClick={onClick} key={i}>
            {cards[55]}
        </div>)}
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
        ev.stopPropagation();
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
};

const DirtyInput: React.FC<{value: string, onChange: (v: string) => void}> = ({value, onChange}) => {
    const [dirtyValue, setDirtyValue] = React.useState<string | null>(null);
    return <input
        style={{width: "100%", boxSizing: 'border-box'}}
        value={dirtyValue == null ? value : dirtyValue}
        onChange={(e) => setDirtyValue(e.target.value === value ? null : e.target.value)}
        onBlur={() => {if (dirtyValue != null) { onChange(dirtyValue); setDirtyValue(null); }}}
        />;
};

const Player: React.FC<{
    value: Game.Player,
    index: number,
    onClick?: (i: number) => void,
}> = observer(({value: player, onClick, index}) => {
    const [x, y, onMouseDown, onMouseMove, onMouseUp] = useMouseMove(player.position, (p) => player.move(p));
    useWindowEventListener("mousemove", onMouseMove);
    useWindowEventListener("mouseup", onMouseUp);
    const [confirm, setConfirm] = React.useState(false);
    React.useEffect(() => {
        if (onClick != null) setConfirm(false);
    }, [onClick]);
    return <div
        style={{
            position: "absolute",
            left: `${x-50}px`,
            top: `${y-50}px`,
            display: "flex",
            flexDirection: "column",
            border: "1px solid black",
            background: "white",
        }}
        onMouseDown={onClick == null ? (e) => onMouseDown(e.nativeEvent) : undefined}
        onClick={onClick == null ? undefined : () => onClick(index)}
    >
        <DirtyInput value={player.name} onChange={(s) => {console.log({s});player.setName(s)}} />
        <div style={{display: "flex"}}>
            {player.cards.length === 0 ? <div style={{margin: "5px"}}>No cards</div> : player.cards.map(
                (c, i) => <div key={i} style={{margin: "5px", width: "40px"}}>{cards[c]}</div>
            )}
        </div>
        <button disabled={onClick != null} onClick={() => confirm ? player.hide() : setConfirm(true)}>{confirm ? "Really DNF?" : "DNF"}</button>
        <button disabled={onClick != null} onClick={() => player.clearCards()}>Clear cards</button>
    </div>;
});

const Players: React.FC<{
    onClick?: (i: number) => void,
}> = observer((props) => {
    console.log("Hello I am observer Players");
    const players = Game.useMst().game.players;
    return <>
        {players.map((p, i) => p.hidden ? null : <Player key={i} value={p} index={i} {...props} />)}
    </>;
});

const GameApp: React.FC<{}> = observer((_props) => {
    const game = Game.useMst().game;
    const [mode, setMode] = React.useState("game");
    const isDragging = mode === "drag" || mode === "dragging" || (mode === "game" && game.cardPile.positions.length === 0);
    useWindowEventListener("mousedown", React.useCallback((ev: MouseEvent) => {
        if (ev.target instanceof Element && (ev.target.tagName === "BUTTON" || ev.target.tagName === "INPUT")) return;
        if (isDragging) {
            setMode("dragging");
            game.restartPile(getMouseXy(ev));
            ev.preventDefault();
            ev.stopPropagation();
        }
        if (mode === "placePlayer") {
            game.addPlayer(getMouseXy(ev));
            setMode("game");
            ev.preventDefault();
            ev.stopPropagation();
        }
    }, [mode]));
    useWindowEventListener("mousemove", React.useCallback((ev: MouseEvent) => {
        if (mode === "dragging") {
            game.pushPile(getMouseXy(ev));
        }
    }, [mode]));
    useWindowEventListener("mouseup", React.useCallback((ev: MouseEvent) => {
        if (mode === "dragging") {
            game.pushPile(getMouseXy(ev));
            setMode("game");
        }
    }, [mode]));
    const drawCard = React.useCallback(() => {
        game.drawCard((Math.random() * 52)|0);
    }, []);
    const drawnCard = game.drawnCard;
    const cardClick = React.useCallback(() => {
        if (drawnCard == null) {
            drawCard();
        }
    }, [drawnCard, drawCard]);

    return <>
        {mode !== "drag" && <Cards coords={[...game.cardPile.positions]} onClick={cardClick} />}
        <Players
            onClick={drawnCard == null ? undefined : (i) => {
                game.giveCard(i);
                setMode("game");
            }}
            />
        <div><button
            onClick={() => setMode((m) => m === "drag" ? "game" : "drag")}
            disabled={!(mode === "drag" && game.cardPile.positions.length > 0 || mode === "game")}
        >{isDragging ? "Deck shuffled - please drag to place the cards" : "Shuffle deck"}</button></div>
        <div><button
            onClick={() => setMode((m) => m === "game" ? "placePlayer" : "game")}
            disabled={!(mode === "game" || mode === "placePlayer")}
        >{mode === "placePlayer" ? "Click the new player's location!" : "Add player"}</button></div>
        {drawnCard == null ? null : <div>
            {"Currently drawn card: "}
            <div style={{display: "inline-block", width: "100px", height: "140px"}}>
                {cards[drawnCard]}
            </div>
        </div>}
    </>;
});

const App: React.FC<{}> = (_props) => {
    const rootRef = React.useRef<Game.RootInstance | null>(null);
    if (rootRef.current == null) {
        let gameData = {
            game: {
                cardPile: {},
            },
        };
        const ls = window.localStorage.getItem("megaprugl");
        if (ls != null) {
            try {
                const lsParsed = JSON.parse(ls);
                if (Game.RootModel.is(lsParsed)) {
                    gameData = lsParsed;
                }
            } catch {
                // Ignore JSON.parse() errors
            }
        }
        rootRef.current = Game.RootModel.create(gameData);
    }
    const root = rootRef.current;
    React.useEffect(() => {
        onSnapshot(root, (snapshot) => {
            localStorage.setItem("megaprugl", JSON.stringify(snapshot));
        })
    }, [root]);
    return <Game.Provider value={root}>
        <GameApp />
    </Game.Provider>;
};

export default App;
