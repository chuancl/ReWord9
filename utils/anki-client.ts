
export interface AnkiResponse<T> {
    result: T;
    error: string | null;
}

export const invokeAnki = async <T>(action: string, params: any = {}, baseUrl: string = 'http://127.0.0.1:8765'): Promise<T> => {
    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            body: JSON.stringify({ action, version: 6, params }),
            headers: { 'Content-Type': 'application/json' }
        });
        const json: AnkiResponse<T> = await response.json();
        if (json.error) {
            throw new Error(String(json.error));
        }
        return json.result;
    } catch (e: any) {
        throw new Error(`Anki Connect Error: ${e.message}`);
    }
};

export const pingAnki = async (baseUrl: string): Promise<string> => {
    return invokeAnki<string>('version', {}, baseUrl);
};

export const getModelNames = async (baseUrl: string): Promise<string[]> => {
    return invokeAnki<string[]>('modelNames', {}, baseUrl);
};

export const getDeckNames = async (baseUrl: string): Promise<string[]> => {
    return invokeAnki<string[]>('deckNames', {}, baseUrl);
};

export const createDeck = async (deck: string, baseUrl: string) => {
    return invokeAnki<number>('createDeck', { deck }, baseUrl);
};

export const createModel = async (
    modelName: string, 
    baseUrl: string, 
    fields: string[] = ["Front", "Back"],
    frontTemplate: string = "{{Front}}",
    backTemplate: string = "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}"
) => {
    return invokeAnki('createModel', {
        modelName,
        inOrderFields: fields,
        css: `.card { font-family: arial; font-size: 20px; text-align: left; color: #334155; background-color: white; padding: 20px; }
              .word { font-size: 32px; font-weight: bold; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
              .field-label { font-size: 12px; color: #94a3b8; font-weight: bold; text-transform: uppercase; margin-top: 10px; }
              .field-value { margin-bottom: 5px; }`,
        cardTemplates: [
            {
                Name: "ReWord Sync Card",
                Front: frontTemplate,
                Back: backTemplate
            }
        ]
    }, baseUrl);
};

export const canAddNotes = async (notes: any[], baseUrl: string) => {
    return invokeAnki<boolean[]>('canAddNotes', { notes }, baseUrl);
};

export const addNotesToAnki = async (notes: any[], baseUrl: string) => {
    return invokeAnki<(number | null)[]>('addNotes', { notes }, baseUrl);
};

export const findNotes = async (query: string, baseUrl: string) => {
    return invokeAnki<number[]>('findNotes', { query }, baseUrl);
};

export const getNotesInfo = async (noteIds: number[], baseUrl: string) => {
    return invokeAnki<any[]>('notesInfo', { notes: noteIds }, baseUrl);
};

export const getCardsInfo = async (query: string, baseUrl: string) => {
    const cardIds = await invokeAnki<number[]>('findCards', { query }, baseUrl);
    if (cardIds.length === 0) return [];
    return invokeAnki<any[]>('cardsInfo', { cards: cardIds }, baseUrl);
};
