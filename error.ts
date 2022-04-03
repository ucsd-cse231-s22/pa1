export class ParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ParseError";
    }
}

export class ReferenceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ReferenceError";
    }
}