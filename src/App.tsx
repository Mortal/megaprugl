import React from 'react';
import * as Game from './Game';
import './App.css';
import { onSnapshot, applySnapshot, onPatch, applyPatch } from "mobx-state-tree";
import { observer } from "mobx-react-lite";

let cards: JSX.Element[] = [];

const useEventListener = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement, event: K,
    cb: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
) => {
    React.useEffect(() => {
        target.addEventListener(event, cb, options);
        return () => target.removeEventListener(event, cb, options);
    }, [target, event, cb]);
};

const useWindowEventListener = <K extends keyof WindowEventMap>(
    event: K,
    cb: (this: Window, ev: WindowEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
) => {
    useEventListener(window as unknown as any, event as unknown as any, cb as unknown as any, options);
};

const Cards: React.FC<{
    coords: (readonly [number, number])[],
    onMouseDown: React.MouseEventHandler<HTMLElement>,
    onTouchStart: React.TouchEventHandler<HTMLElement>,
}> =
({coords, onMouseDown, onTouchStart}) => {
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
        <div
            key={i}
            style={{
                position: "absolute",
                left: `${x-w/2}px`,
                top: `${y-w*1.5/2}px`,
                display: "flex",
                width: `${w}px`,
                height: `${w*1.5}px`,
                transform: `rotate(${dir}deg)`,
            }}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
        >
            {cards[55]}
        </div>)}
    </>;
}

const getMouseXy = (ev: MouseEvent|Touch) => {
    return [ev.clientX, ev.clientY] as const;
};

const useMouseMove = (pos: readonly [number, number], setPos: (p: readonly [number, number]) => void, extra?: {onEnd: (ev: MouseEvent | Touch) => void}) => {
    const {onEnd} = extra || {};
    const [x, y] = pos;
    const [[dx, dy], setD] = React.useState([0 as number, 0 as number] as const);
    const [s, setS] = React.useState<null | readonly [number, number]>(null);
    const [_active, onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd] = usePointerEventHandlers(
        {
            start: React.useCallback((ev: MouseEvent | Touch) => {
                setS(getMouseXy(ev));
            }, []),
            move: React.useCallback((ev: MouseEvent | Touch) => {
                if (s == null) return;
                const [xx, yy] = getMouseXy(ev);
                const [sx, sy] = s;
                setD([xx - sx, yy - sy]);
            }, [s]),
            end: React.useCallback((ev: MouseEvent | Touch) => {
                setS(null);
                setD([0, 0]);
                if (dx !== 0 || dy !== 0) {
                    setPos([x + dx, y + dy]);
                }
                if (onEnd != null) onEnd(ev);
            }, [x, y, dx, dy, s, setPos, onEnd]),
        }
    );
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

const classNames = (cs: {[c: string]: boolean}) => Object.keys(cs).filter((c) => cs[c]).join(" ");

const usePointerEventHandlers = (s: {
    canStart?: boolean,
    target?: Element,
    start?: (ev: MouseEvent | Touch) => void,
    move?: (ev: MouseEvent | Touch) => void,
    end?: (ev: MouseEvent | Touch) => void,
}) => {
    const canStart = s.canStart == null || s.canStart;
    const [active, setActive] = React.useState<null | number | "mouse">(null);
    const {start, move, end} = s;
    const mousedown = React.useCallback((ev: MouseEvent) => {
        if (ev.target instanceof Element && (ev.target.tagName === "BUTTON" || ev.target.tagName === "INPUT")) return;
        if (!canStart) return;
        setActive("mouse");
        if (start != null) start(ev);
        ev.preventDefault();
        ev.stopPropagation();
    }, [start, canStart]);
    const mousemove = React.useCallback((ev: MouseEvent) => {
        if (active !== "mouse") return;
        if (move != null) move(ev);
        ev.preventDefault();
        ev.stopPropagation();
    }, [move, active]);
    const mouseup = React.useCallback((ev: MouseEvent) => {
        if (active !== "mouse") return;
        if (end != null) end(ev);
        setActive(null);
        ev.preventDefault();
        ev.stopPropagation();
    }, [end, active]);
    const touchstart = React.useCallback((ev: TouchEvent) => {
        if (ev.target instanceof Element && (ev.target.tagName === "BUTTON" || ev.target.tagName === "INPUT")) return;
        if (!canStart) return;
        setActive(ev.touches[0].identifier);
        if (start != null) start(ev.touches[0]);
        // ev.preventDefault();
        // ev.stopPropagation();
    }, [start, canStart]);
    const touchmove = React.useCallback((ev: TouchEvent) => {
        if (active == null || active === "mouse") return;
        const touches = ev.changedTouches;
        for (let i = 0; i < touches.length; ++i) {
            if (touches[i].identifier === active) {
                if (move != null) move(touches[i]);
                ev.stopPropagation();
                ev.preventDefault();
                return;
            }
        }
    }, [move, active]);
    const touchend = React.useCallback((ev: TouchEvent) => {
        if (active == null || active === "mouse") return;
        const touches = ev.changedTouches;
        for (let i = 0; i < touches.length; ++i) {
            if (touches[i].identifier === active) {
                if (end != null) end(touches[i]);
                setActive(null);
                ev.stopPropagation();
                ev.preventDefault();
                return;
            }
        }
    }, [end, active]);
    return [active != null, mousedown, mousemove, mouseup, touchstart, touchmove, touchend] as const;
};

const usePointerEvents = (s: {
    canStart?: boolean,
    target?: Element,
    start?: (ev: MouseEvent | Touch) => void,
    move?: (ev: MouseEvent | Touch) => void,
    end?: (ev: MouseEvent | Touch) => void,
}) => {
    const [active, mousedown, mousemove, mouseup, touchstart, touchmove, touchend] = usePointerEventHandlers(s);
    useEventListener(s.target ?? window as unknown as any, "mousedown", mousedown);
    useWindowEventListener("mousemove", mousemove);
    useWindowEventListener("mouseup", mouseup);
    useEventListener(s.target ?? window as unknown as any, "touchstart", touchstart, {passive: false});
    useWindowEventListener("touchmove", touchmove, {passive: false});
    useWindowEventListener("touchend", touchend);
    return active;
};

const GameApp: React.FC<{}> = observer((_props) => {
    const game = Game.useMst().game;
    const [mode, setMode] = React.useState("game");
    const isStartDrag = mode === "drag" || mode === "dragging" || (mode === "game" && game.cardPile.positions.length === 0);
    const isDragging = usePointerEvents(
        {
            canStart: isStartDrag,
            start: React.useCallback((ev: MouseEvent | Touch) => {
                game.restartPile(getMouseXy(ev));
            }, [game]),
            move: React.useCallback((ev: MouseEvent | Touch) => {
                game.pushPile(getMouseXy(ev));
            }, [game]),
        }
    ) || isStartDrag;
    usePointerEvents(
        {
            canStart: mode === "placePlayer",
            start: React.useCallback((ev: MouseEvent | Touch) => {
                game.addPlayer(getMouseXy(ev));
                setMode("game");
            }, [game]),
        }
    );
    const drawCard = React.useCallback(() => {
        game.drawCard((Math.random() * 52)|0);
    }, []);
    const drawnCard = game.drawnCard;
    const [drawnPosition, setDrawnPosition] = React.useState<null | readonly [number, number]>(null);

    const [drawnX, drawnY, drawnMouseDown, drawnTouchStart] = useDraggable(drawnPosition ?? [0, 0], setDrawnPosition);
    const cardMouseDown = React.useCallback((ev: React.MouseEvent<HTMLElement>) => {
        if (drawnCard == null) {
            drawCard();
            setDrawnPosition(getMouseXy(ev.nativeEvent));
            drawnMouseDown(ev.nativeEvent);
        }
    }, [drawnCard, drawCard, drawnMouseDown]);
    const cardTouchStart = React.useCallback((ev: React.TouchEvent<HTMLElement>) => {
        if (drawnCard == null) {
            drawCard();
            setDrawnPosition(getMouseXy(ev.nativeEvent.touches[0]));
            drawnTouchStart(ev.nativeEvent);
        }
    }, [drawnCard, drawCard, drawnTouchStart]);

    return <>
        {mode !== "drag" && <Cards coords={[...game.cardPile.positions]} onMouseDown={cardMouseDown} onTouchStart={cardTouchStart} />}
        <div style={{display: 'flex', flexDirection: 'row'}}>
            <button
                className={classNames({tool: true, selected: isDragging})}
                onClick={() => setMode((m) => m === "drag" ? "game" : "drag")}
                disabled={!(mode === "drag" && game.cardPile.positions.length > 0 || mode === "game")}
            >Shuffle deck</button>
            <button
                className={classNames({tool: true, selected: mode === "placePlayer"})}
                onClick={() => setMode((m) => m === "game" ? "placePlayer" : "game")}
                disabled={!(mode === "game" || mode === "placePlayer")}
            >Add player</button>
        </div>
        <div>
            {mode === "placePlayer" ? "Click to place a player!" :
            isDragging ? "Deck shuffled - drag to lay down the new cards!" :
            "Play game!"}
        </div>
        <UndoRedo />
        <Players
            onClick={drawnCard == null ? undefined : (i) => {
                game.giveCard(i);
                setMode("game");
            }}
            />
        {drawnCard == null ? null : <>
        <div>
            <button onClick={() => game.discardDrawnCard()}>Discard drawn card</button>
        </div>
        {
            drawnPosition == null ?
            <div style={{position: 'relative'}}>
                {"Currently drawn card: "}
                <div style={{display: "inline-block", width: "100px", height: "140px"}}>
                    {cards[drawnCard]}
                </div>
            </div> : 
            <div
                style={{
                    display: "inline-block",
                    width: "100px",
                    height: "140px",
                    position: "absolute",
                    left: (drawnX - 50) + "px",
                    top: (drawnY - 50) + "px",
                }}
                onMouseDown={(e) => void(drawnMouseDown(e.nativeEvent))}
                onTouchStart={(e) => void(drawnTouchStart(e.nativeEvent))}
            >
                {cards[drawnCard]}
            </div>
        }
        </>}
    </>;
});

const useDraggable = (
    position: readonly [number, number],
    setPosition: (p: readonly [number, number]) => void,
    onEnd?: (ev: MouseEvent | Touch) => void,
) => {
    const [x, y, onMouseDown, onMouseMove, onMouseUp, onTouchStart, onTouchMove, onTouchEnd] = useMouseMove(position, setPosition, {onEnd});
    useWindowEventListener("mousemove", onMouseMove);
    useWindowEventListener("mouseup", onMouseUp);
    useWindowEventListener("touchmove", onTouchMove, {passive: false});
    useWindowEventListener("touchend", onTouchEnd);
    return [x, y, onMouseDown, onTouchStart] as const;
};

const Draggable: React.FC<{
    position: readonly [number, number]
    setPosition: (p: readonly [number, number]) => void,
    onEnd?: (ev: MouseEvent | Touch) => void,
    children: (x: number, y: number, onMouseDown: React.MouseEventHandler, onTouchStart: React.TouchEventHandler) => React.ReactElement
}> = ({position, setPosition, onEnd, children}) => {
    const [x, y, onMouseDown, onTouchStart] = useDraggable(position, setPosition, onEnd);
    return children(x, y, (e) => void(onMouseDown(e.nativeEvent)), (e) => void(onTouchStart(e.nativeEvent)));
};

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
    const [cardsLoaded, setCardsLoaded] = React.useState(false);
    React.useEffect(async () => {
        cards = (await import("./Cards")).cards;
        setCardsLoaded(true)
    }, []);
    return <Game.Provider value={root}>
        {cardsLoaded ? <GameApp /> : null}
    </Game.Provider>;
};

export default App;
