import * as fs from 'fs-extra';
import {logger} from '@hopin/logger';

type PageInfo = {
    path: string
    subnav: string|Array<PageInfo>
}

class NavNode {
    private pagePath: string|null
    private leafNodes: Array<NavNode>

    constructor(pagePath: string|null, leafNodes: Array<NavNode>) {
        this.pagePath = pagePath;
        this.leafNodes = leafNodes;
    }
}

async function getNavNode(pathPath: null|string, navigation: null|string|Array<PageInfo>): Promise<NavNode> {
    if (typeof navigation === 'string') {
        // TODO: Read file
        navigation = [];
    }
    const leafNodes: Array<NavNode> = [];
    if (navigation) {
        for (const page of navigation) {
            leafNodes.push(await getNavNode(page.path, page.subnav));
        }
    }

    return new NavNode(pathPath, leafNodes);
}

export async function getNavTree(navigationFile: string): Promise<NavNode> {
    let navigation: Array<PageInfo> = [];
    if (navigationFile) {
        try {
            const navBuffer = await fs.readFile(navigationFile);
            const navString = navBuffer.toString();
            navigation = JSON.parse(navString);
        } catch (err) {
            logger.error(`Unable to read and parse the navigation file '${navigationFile}': `, err);
            throw new Error(`Unable to read and parse navigation file '${navigationFile}'`);
        }
    }

    const navTree = await getNavNode(null, navigation);
    console.log(navTree);
    return navTree;
}