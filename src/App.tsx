import React from 'react';
import * as Game from './Game';
import './App.css';
import { onSnapshot, applySnapshot, onPatch, applyPatch } from "mobx-state-tree";
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
    const minDist = 20;
    const outputs = [];
    const distsq = (i: number, j: number) => {
        const [x1, y1] = coords[i];
        const [x2, y2] = coords[j];
        const dx = x1 - x2;
        const dy = y1 - y2;
        return dx * dx + dy * dy;
    };
    const direction = (i: number, j: number) => {
        const [x1, y1] = coords[i];
        const [x2, y2] = coords[j];
        const dx = x1 - x2;
        const dy = y1 - y2;
        return Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    }
    let prevDirection = 0;
    for (let i = 0; i < coords.length;) {
        let j = i + 1;
        while (j < coords.length && distsq(i, j) < minDist*minDist) ++j;
        const dir = j == coords.length ? prevDirection : direction(i, j);
        outputs.push({pos: coords[i], dir});
        i = j;
        prevDirection = dir;
    }
    return <>
        {outputs.map(({pos: [x, y], dir}, i) =>
        <div style={{
            position: "absolute",
            left: `${x-w/2}px`,
            top: `${y-w*1.5/2}px`,
            display: "flex",
            width: `${w}px`,
            height: `${w*1.5}px`,
            transform: `rotate(${dir}deg)`,
        }} onClick={onClick} key={i}>
            {cards[55]}
        </div>)}
    </>;
}

const getMouseXy = (ev: MouseEvent|Touch) => {
    return [ev.clientX, ev.clientY] as const;
};

const useMouseMove = (pos: readonly [number, number], setPos: (p: readonly [number, number]) => void) => {
    const [x, y] = pos;
    const [[dx, dy], setD] = React.useState([0 as number, 0 as number] as const);
    const [s, setS] = React.useState<null | {touch?: number, pos: readonly [number, number]}>(null);
    const onMouseDown = React.useCallback((ev: MouseEvent) => {
        setS({pos: getMouseXy(ev)});
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
        if (s.touch != null) return;
        const [xx, yy] = getMouseXy(ev);
        const [sx, sy] = s.pos;
        setD([xx - sx, yy - sy]);
    }, [s]);
    const onTouchStart = React.useCallback((ev: TouchEvent) => {
        const touches = ev.changedTouches;
        setS({touch: touches[0].identifier, pos: getMouseXy(touches[0])});
        // ev.preventDefault();
        // ev.stopPropagation();
    }, []);
    const onTouchMove = React.useCallback((ev: TouchEvent) => {
        if (s == null) return;
        const {touch, pos} = s;
        if (touch == null) return;
        const touches = ev.changedTouches;
        for (let i = 0; i < touches.length; ++i) {
            if (touches[i].identifier === touch) {
                const [xx, yy] = getMouseXy(touches[i]);
                const [sx, sy] = s.pos;
                setD([xx - sx, yy - sy]);
                ev.preventDefault();
                ev.stopPropagation();
                return;
            }
        }
    }, [s]);
    const onTouchEnd = React.useCallback((ev: TouchEvent) => {
        if (s == null) return;
        const {touch, pos} = s;
        if (touch == null) return;
        const touches = ev.changedTouches;
        for (let i = 0; i < touches.length; ++i) {
            if (touches[i].identifier === touch) {
                setS(null);
                setD([0, 0]);
                if (dx !== 0 || dy !== 0) {
                    setPos([x + dx, y + dy]);
                    ev.preventDefault();
                    ev.stopPropagation();
                }
                return;
            }
        }
    }, [x, y, dx, dy, s, setPos]);
    return [x + dx, y + dy, onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd] as const;
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

const describeSum = (cardIndexes: number[]) => {
    const cardValues = cardIndexes.map((c) => (c % 13) + 1);
    const aces = cardValues.filter((c) => c === 1).length;
    const sum = cardValues.reduce((a, b) => a + b, 0);
    let s = `${sum}`;
    for (let i = 1; i <= aces; ++i) {
        s = `${s} or ${sum + i * 13}`;
    }
    return s;
    // return JSON.stringify({s, aces, cardValues});
};

const Player: React.FC<{
    value: Game.Player,
    index: number,
    onClick?: (i: number) => void,
}> = observer(({value: player, onClick, index}) => {
    const [x, y, onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd] = useMouseMove(player.position, (p) => player.move(p));
    useWindowEventListener("mousemove", onMouseMove);
    useWindowEventListener("mouseup", onMouseUp);
    useWindowEventListener("touchmove", onTouchMove, {passive: false});
    useWindowEventListener("touchend", onTouchEnd, {passive: false});
    const [confirm, setConfirm] = React.useState(false);
    React.useEffect(() => {
        if (onClick != null) setConfirm(false);
    }, [onClick]);
    const divRef = React.useRef<HTMLDivElement | null>(null);
    React.useLayoutEffect(() => {
        const d = divRef.current;
        if (d == null) return;
        if (onClick != null) return;
        d.addEventListener("touchstart", onTouchStart, {passive: false});
        return () => d.removeEventListener("touchstart", onTouchStart);
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
            width: "250px",
        }}
        ref={(d) => {divRef.current = d;}}
        onMouseDown={onClick == null ? (e) => onMouseDown(e.nativeEvent) : undefined}
        onClick={onClick == null ? undefined : () => onClick(index)}
    >
        <DirtyInput value={player.name} onChange={(s) => {console.log({s});player.setName(s)}} />
        <div style={{margin: "5px", textAlign: 'center'}}>{player.cards.length === 0 ? "No cards" : `Σ = ${describeSum([...player.cards])}`}</div>
        <div style={{display: "flex", alignSelf: 'center', flexWrap: 'wrap'}}>
            {player.cards.map(
                (c, i) => <div key={i} style={{margin: "5px", width: "40px"}} title={`${c}`}>{cards[c]}</div>
            )}
        </div>
        <button disabled={onClick != null} onClick={() => confirm ? player.hide() : setConfirm(true)}>{confirm ? "Really DNF?" : "DNF"}</button>
        <button disabled={onClick != null} onClick={() => player.clearCards()}>Clear cards</button>
    </div>;
});

const Players: React.FC<{
    onClick?: (i: number) => void,
}> = observer((props) => {
    const players = Game.useMst().game.players;
    return <>
        {players.map((p, i) => p.hidden ? null : <Player key={i} value={p} index={i} {...props} />)}
    </>;
});

const UndoRedo: React.FC<{}> = (_props) => {
    const root = Game.useMst();
    const [undotree, setUndotree] = React.useState<any>(null);
    const applying = React.useRef(false);
    React.useEffect(
        () => onPatch(root, (patch, reversePatch) => {
            if (applying.current) {
                return;
            }
            setUndotree((undo) =>
                ({patch, reversePatch, undo, redo: []}));
        }), [],
    );
    const undo = React.useCallback(() => {
        setUndotree((current) => {
            if (current == null) {
                return null;
            }
            const {reversePatch, undo} = current;
            applying.current = true;
            applyPatch(root, reversePatch);
            applying.current = false;
            return {...undo, redo: [...undo.redo, current]};
        })
    }, []);
    const redo = React.useCallback(() => {
        setUndotree((current) => {
            if (current == null) {
                return null;
            }
            const {redo} = current;
            if (redo.length === 0) {
                return current;
            }
            applying.current = true;
            applyPatch(root, redo[redo.length - 1].patch);
            applying.current = false;
            return {...redo[redo.length - 1], undo: current};
        })
    }, []);
    return <>
        {/* <div><button onClick={undo}>Undo</button></div>
        <div><button onClick={redo}>Redo</button></div> */}
    </>
};

const GameApp: React.FC<{}> = observer((_props) => {
    const game = Game.useMst().game;
    const [mode, setMode] = React.useState("game");
    const [draggingTouch, setDraggingTouch] = React.useState<number | null>(null);
    const isDragging = mode === "drag" || mode === "dragging" || (mode === "game" && game.cardPile.positions.length === 0);
    useWindowEventListener("mousedown", React.useCallback((ev: MouseEvent) => {
        if (ev.target instanceof Element && (ev.target.tagName === "BUTTON" || ev.target.tagName === "INPUT")) return;
        if (isDragging) {
            setMode("dragging");
            setDraggingTouch(null);
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
        if (mode === "dragging" && draggingTouch == null) {
            game.pushPile(getMouseXy(ev));
        }
    }, [mode, draggingTouch == null]));
    useWindowEventListener("mouseup", React.useCallback((ev: MouseEvent) => {
        if (mode === "dragging" && draggingTouch == null) {
            game.pushPile(getMouseXy(ev));
            setMode("game");
        }
    }, [mode, draggingTouch == null]));
    useWindowEventListener("touchstart", React.useCallback((ev: TouchEvent) => {
        if (ev.target instanceof Element && (ev.target.tagName === "BUTTON" || ev.target.tagName === "INPUT")) return;
        if (isDragging) {
            setMode("dragging");
            setDraggingTouch(ev.touches[0].identifier);
            game.restartPile(getMouseXy(ev.touches[0]));
            ev.preventDefault();
            ev.stopPropagation();
        }
    }, [mode]), {passive: false});
    useWindowEventListener("touchmove", React.useCallback((ev: TouchEvent) => {
        if (mode === "dragging" && draggingTouch != null) {
            const touches = ev.changedTouches;
            for (let i = 0; i < touches.length; ++i) {
                if (touches[i].identifier === draggingTouch) {
                    game.pushPile(getMouseXy(touches[i]));
                    ev.stopPropagation();
                    ev.preventDefault();
                    return;
                }
            }
        }
    }, [mode, draggingTouch]), {passive: false});
    useWindowEventListener("touchend", React.useCallback((ev: TouchEvent) => {
        if (mode === "dragging" && draggingTouch != null) {
            const touches = ev.changedTouches;
            for (let i = 0; i < touches.length; ++i) {
                if (touches[i].identifier === draggingTouch) {
                    game.pushPile(getMouseXy(touches[i]));
                    setDraggingTouch(null);
                    setMode("game");
                    ev.stopPropagation();
                    ev.preventDefault();
                    return;
                }
            }
        }
    }, [mode, draggingTouch]));
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
        <div><button
            onClick={() => setMode((m) => m === "drag" ? "game" : "drag")}
            disabled={!(mode === "drag" && game.cardPile.positions.length > 0 || mode === "game")}
        >{isDragging ? "Deck shuffled - please drag to place the cards" : "Shuffle deck"}</button></div>
        <div><button
            onClick={() => setMode((m) => m === "game" ? "placePlayer" : "game")}
            disabled={!(mode === "game" || mode === "placePlayer")}
        >{mode === "placePlayer" ? "Click the new player's location!" : "Add player"}</button></div>
        <UndoRedo />
        {drawnCard == null ? null : <>
        <div>
            <button onClick={() => game.discardDrawnCard()}>Discard drawn card</button>
        </div>
        <div style={{position: 'relative'}}>
            {"Currently drawn card: "}
            <div style={{display: "inline-block", width: "100px", height: "140px"}}>
                {cards[drawnCard]}
            </div>
        </div>
        </>}
        <Players
            onClick={drawnCard == null ? undefined : (i) => {
                game.giveCard(i);
                setMode("game");
            }}
            />
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
        return onSnapshot(root, (snapshot) => {
            localStorage.setItem("megaprugl", JSON.stringify(snapshot));
        });
    }, [root]);
    return <Game.Provider value={root}>
        <GameApp />
    </Game.Provider>;
};

export default App;
