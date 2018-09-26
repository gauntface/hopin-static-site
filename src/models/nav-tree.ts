import * as fs from 'fs-extra';
import * as path from 'path';
import {logger} from '@hopin/logger';
import * as json5 from 'json5';

type PageInfo = {
    path: string
    subnav: string|Array<PageInfo>
}

class NavNode {
    pagePath: string|null
    leafNodes: Array<NavNode>

    constructor(pagePath: string|null, leafNodes: Array<NavNode>) {
        this.pagePath = pagePath;
        this.leafNodes = leafNodes;
    }
}

async function getNavNode(relativePath: string, pagePath: null|string, navigation: null|string|Array<PageInfo>): Promise<NavNode> {
    if (typeof navigation === 'string') {
        // TODO: Read file
        const navFileBuffer = await fs.readFile(path.resolve(relativePath, navigation));
        navigation = json5.parse(navFileBuffer.toString()) as Array<PageInfo>;
    }
    const leafNodes: Array<NavNode> = [];
    if (navigation) {
        for (const page of navigation) {
            leafNodes.push(await getNavNode(relativePath, page.path, page.subnav));
        }
    }

    return new NavNode(pagePath, leafNodes);
}

export async function getNavTree(navigationFile: string): Promise<NavNode> {
    if (!navigationFile) {
        return new NavNode(null, []);
    }

    try {
        await fs.access(navigationFile);
    } catch (err) {
        logger.warn(`Unable to find navigation file '${navigationFile}'. No navigation will be included in build.`);
        return new NavNode(null, []);
    }

    let navigation: Array<PageInfo> = [];
    if (navigationFile) {
        try {
            const navBuffer = await fs.readFile(navigationFile);
            const navString = navBuffer.toString();
            navigation = json5.parse(navString);
        } catch (err) {
            logger.error(`Unable to read and parse the navigation file '${navigationFile}': `, err);
            throw new Error(`Unable to read and parse navigation file '${navigationFile}'`);
        }
    }

    return getNavNode(path.dirname(navigationFile), null, navigation);
}