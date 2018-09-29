import * as fs from 'fs-extra';
import * as path from 'path';
import {logger} from '@hopin/logger';
import * as json5 from 'json5';
import * as matter from 'gray-matter';

type PageInfo = {
    path: string
    subnav: string|Array<PageInfo>
}

class NavNode {
    pagePath: string|null
    title: string
    leafNodes: Array<NavNode>

    constructor(pagePath: string|null, title: string, url: string, leafNodes: Array<NavNode>) {
        this.pagePath = pagePath;
        this.leafNodes = leafNodes;
    }
}

async function parseNavigation(relativePath: string, navigation: null|string|Array<PageInfo>): Promise<Array<PageInfo>> {
    if (!navigation) {
        return [];
    }

    if (typeof navigation === 'string') {
        const navFileBuffer = await fs.readFile(path.resolve(relativePath, navigation));
        navigation = json5.parse(navFileBuffer.toString()) as Array<PageInfo>;
    }

    return navigation;
}

async function getNavNode(relativePath: string, pagePath: null|string, navigation: Array<PageInfo>): Promise<NavNode> {
    const leafNodes: Array<NavNode> = [];
    if (navigation) {
        for (const page of navigation) {
            const subnav = await parseNavigation(relativePath, page.subnav);
            leafNodes.push(await getNavNode(relativePath, page.path, subnav));
        }
    }
    
    // TODO: Get YAML from page path
    const frontMatter = matter(path.resolve(relativePath, pagePath));
    // tslint:disable-next-line:no-any
    const yaml = frontMatter.data as any;

    return new NavNode(pagePath, yaml.title, '', leafNodes);
}

export async function getNavTree(navigationFile: string): Promise<Array<NavNode>> {
    if (!navigationFile) {
        return [];
    }

    try {
        await fs.access(navigationFile);
    } catch (err) {
        logger.warn(`Unable to find navigation file '${navigationFile}'. No navigation will be included in build.`);
        return [];
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

    const topNav = await parseNavigation(path.dirname(navigationFile), navigation);
    const pages: Array<NavNode> = [];
    for (const pagePath of topNav) {
        const nav = await parseNavigation(path.dirname(navigationFile), pagePath.subnav);
        pages.push(await getNavNode(path.dirname(navigationFile), pagePath.path, nav));
    }
    return pages;
}