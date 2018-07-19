const cache: string[] = [];

export function isNew(buildId: string): boolean {
    const inThere = cache.includes(buildId);
    if (inThere) {
        return false;
    }
    cache.push(buildId);
    return true;
}
