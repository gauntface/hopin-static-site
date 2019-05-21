import * as fs from 'fs-extra';
import * as path from 'path';
import * as json5 from 'json5';
import * as matter from 'gray-matter';

import { Config } from './config';
import { logger } from '../utils/logger';

type PageInfo = {
    path: string
    hidden: boolean
    subnav: string|PageInfo[]
};

export class NavNode {
    pagePath: string|null;
    title: string;
    url: string;
    hidden: boolean;
    yaml: {};
    leafNodes: NavNode[];

    // tslint:disable-next-line:no-any
    constructor(pagePath: string|null, title: string, url: string, hidden: boolean, yaml: any, leafNodes: NavNode[]) {
        this.pagePath = pagePath;
        this.title = title;
        this.url = url;
        this.hidden = hidden ? true : false;
        this.yaml = yaml;
        this.leafNodes = leafNodes;
    }
}

async function parseNavigation(relativePath: string, navigation: null|string|PageInfo[]): Promise<PageInfo[]> {
    if (!navigation) {
        return [];
    }

    if (typeof navigation === 'string') {
        const navFileBuffer = await fs.readFile(path.resolve(relativePath, navigation));
        navigation = json5.parse(navFileBuffer.toString()) as PageInfo[];
    }

    return navigation;
}

async function getNavNode(pageIDs: {[id: string]: NavNode}, contentPath: string, relativeNavigationFilePath: string, pageInfo: PageInfo, navigation: PageInfo[]): Promise<NavNode> {
    const leafNodes: NavNode[] = [];
    if (navigation) {
        for (const page of navigation) {
            const subnav = await parseNavigation(relativeNavigationFilePath, page.subnav);
            const node = await getNavNode(pageIDs, contentPath, relativeNavigationFilePath, page, subnav);
            if (!node.hidden) {
                leafNodes.push(node);
            }
        }
    }

    // TODO: Get YAML from page path
    const absolutePath = path.resolve(relativeNavigationFilePath, pageInfo.path);
    const pageContents = await fs.readFile(absolutePath);
    const frontMatter = matter(pageContents);
    // tslint:disable-next-line:no-any
    const yaml = frontMatter.data as any;

    const relativeFilePath = path.relative(contentPath, absolutePath);
    const url = path.join('/', relativeFilePath.replace('index.md', '').replace('.md', '.html'));

    const navNode = new NavNode(pageInfo.path, yaml.title, url, pageInfo.hidden, yaml, leafNodes);
    if (yaml.id) {
        pageIDs[yaml.id] = navNode;
    }

    return navNode;
}

export async function getNavTree(config: Config): Promise<{[id: string]: NavNode[]}> {
    if (!config.navigationFile) {
        return {};
    }

    try {
        await fs.access(config.navigationFile);
    } catch (err) {
        logger.warn(`Unable to find navigation file '${config.navigationFile}'. No navigation will be included in build.`);
        return {};
    }

    let navigation: PageInfo[] = [];
    if (config.navigationFile) {
        try {
            const navBuffer = await fs.readFile(config.navigationFile);
            const navString = navBuffer.toString();
            navigation = json5.parse(navString);
        } catch (err) {
            logger.error(`Unable to read and parse the navigation file '${config.navigationFile}': `, err);
            throw new Error(`Unable to read and parse navigation file '${config.navigationFile}'`);
        }
    }

    const topNav = await parseNavigation(path.dirname(config.navigationFile), navigation);
    const pages: NavNode[] = [];
    const pageIDs: {[id: string]: NavNode} = {};
    for (const pageInfo of topNav) {
        const nav = await parseNavigation(path.dirname(config.navigationFile), pageInfo.subnav);
        const node = await getNavNode(pageIDs, config.contentPath, path.dirname(config.navigationFile), pageInfo, nav);
        if (!pageInfo.hidden) {
            pages.push(node);
        }
    }
    return Object.assign(pageIDs, {pages});
}