import React from 'react';
import { Instance, types, onSnapshot } from "mobx-state-tree";

export type Card = number;
export const Card = types.number;

export type Point2 = readonly [number, number];
export const Point2 = types.custom<number[], Point2>({
    name: "Point2",
    fromSnapshot(value) { return [value[0], value[1]] as const; },
    toSnapshot(value) { return [...value]; },
    isTargetType(value) { return value != null && value.length === 2; },
    getValidationMessage(value) { return value != null && value.length === 2 ? "" : "Wrong length"; },
});

export const PlayerModel = types.model("Player", {
    name: types.string,
    position: Point2,
    cards: types.array(Card),
    hidden: false,
}).actions((self) => ({
    setName(name: string) { self.name = name; },
    clearCards() { self.cards.clear(); },
    addCard(card: Card) { self.cards.push(card); },
    move(newPosition: Point2) { self.position = newPosition; },
    hide() { self.hidden = true; },
}));
export type Player = Instance<typeof PlayerModel>;

export const CardPile = types.model("CardPile", {
    positions: types.array(Point2),
}).actions((self) => ({
    restart(pos: Point2) {self.positions.clear(); self.positions.push(pos);},
    push(pos: Point2) {self.positions.push(pos);},
}));

export const Game = types.model("Game", {
    drawnCard: types.maybe(Card),
    players: types.array(PlayerModel),
    cardPile: CardPile,
}).actions((self) => ({
    drawCard(newCard: Card) {
        if (self.drawnCard != undefined) return;
        self.drawnCard = newCard;
    },
    discardDrawnCard() {
        self.drawnCard = undefined;
    },
    giveCard(playerIndex: number) {
        if (self.drawnCard == undefined) return;
        self.players[playerIndex].addCard(self.drawnCard);
        self.drawnCard = undefined;
    },
    restartPile(pos: Point2) { self.cardPile.restart(pos); },
    pushPile(pos: Point2) { self.cardPile.push(pos); },
    addPlayer(position: Point2, name?: string) {
        self.players.push(PlayerModel.create({
            name: name == null ? `Player ${self.players.length + 1}` : name,
            position,
        }));
    },
}));

export const RootModel = types.model("Root", {
    game: Game,
});

export type RootInstance = Instance<typeof RootModel>;
const RootStoreContext = React.createContext<null | RootInstance>(null);
export const Provider = RootStoreContext.Provider;

export function useMst() {
    const store = React.useContext(RootStoreContext);
    if (store == null) {
      throw new Error("Store cannot be null, please add a context provider");
    }
    return store;
}
