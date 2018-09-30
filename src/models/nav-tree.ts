import * as fs from 'fs-extra';
import * as path from 'path';
import {logger} from '@hopin/logger';
import * as json5 from 'json5';
import * as matter from 'gray-matter';
import { Config } from './config';

type PageInfo = {
    path: string
    subnav: string|Array<PageInfo>
}

export class NavNode {
    pagePath: string|null
    title: string
    url: string
    yaml: {}
    leafNodes: Array<NavNode>

    // tslint:disable-next-line:no-any
    constructor(pagePath: string|null, title: string, url: string, yaml: any, leafNodes: Array<NavNode>) {
        this.pagePath = pagePath;
        this.title = title;
        this.url = url;
        this.yaml = yaml;
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

async function getNavNode(pageIDs: {[id: string]: NavNode}, contentPath: string, relativeNavigationFilePath: string, pagePath: null|string, navigation: Array<PageInfo>): Promise<NavNode> {
    const leafNodes: Array<NavNode> = [];
    if (navigation) {
        for (const page of navigation) {
            const subnav = await parseNavigation(relativeNavigationFilePath, page.subnav);
            leafNodes.push(await getNavNode(pageIDs, contentPath, relativeNavigationFilePath, page.path, subnav));
        }
    }
    
    // TODO: Get YAML from page path
    const absolutePath = path.resolve(relativeNavigationFilePath, pagePath);
    const pageContents = await fs.readFile(absolutePath);
    const frontMatter = matter(pageContents);
    // tslint:disable-next-line:no-any
    const yaml = frontMatter.data as any;

    const relativeFilePath = path.relative(contentPath, absolutePath);
    const url = path.join('/', relativeFilePath.replace('index.md', ''));

    const navNode = new NavNode(pagePath, yaml.title, url, yaml, leafNodes);
    if (yaml.id) {
        pageIDs[yaml.id] = navNode;
    }
    return navNode;
}

export async function getNavTree(config: Config): Promise<Array<NavNode>> {
    if (!config.navigationFile) {
        return [];
    }

    try {
        await fs.access(config.navigationFile);
    } catch (err) {
        logger.warn(`Unable to find navigation file '${config.navigationFile}'. No navigation will be included in build.`);
        return [];
    }

    let navigation: Array<PageInfo> = [];
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
    const pages: Array<NavNode> = [];
    const pageIDs: {[id: string]: NavNode} = {};
    for (const pagePath of topNav) {
        const nav = await parseNavigation(path.dirname(config.navigationFile), pagePath.subnav);
        pages.push(await getNavNode(pageIDs, config.contentPath, path.dirname(config.navigationFile), pagePath.path, nav));
    }
    return Object.assign(pageIDs, pages);
}