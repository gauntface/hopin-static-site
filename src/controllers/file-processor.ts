import {createHTMLTemplateFromFile, createComponentTemplateFromFile} from '@hopin/render';
import * as handlebars from 'handlebars';
import {renderMarkdown} from '@hopin/markdown';
import * as fs from 'fs-extra';
import * as path from 'path';
import { parse, NodeType, Node, HTMLElement } from 'node-html-parser';
import * as sizeOf from 'image-size';
import * as https from 'https';
import * as http from 'http';

import { logger } from '../utils/logger';
import { Message, RUN_WITH_DETAILS_MSG } from './worker-pool';
import { InternalConfig } from '../models/config';
import {NavNode} from '../models/nav-tree';

async function run(inputPath: string, config: InternalConfig, variables: {}, navigation: {[id: string]: NavNode[]}): Promise<Message> {
  // TODO: Check files exist first
  try {
    const compTmpl = await createComponentTemplateFromFile(inputPath);
    // Render the original page and run it through the markdown parser
    const compBundle = await compTmpl.render(
      Object.assign(variables, {
        page: compTmpl.yaml,
        navigation,
      }),
    );

    compBundle.renderedTemplate = await renderMarkdown(compBundle.renderedTemplate, {
        staticDir: config.staticPath,
    });
    
    compBundle.renderedTemplate = await standardizeHTML(compBundle.renderedTemplate, config.staticPath);

    // tslint:disable-next-line
    const yaml = compTmpl.yaml as {
      elements?: string[];
      layout?: string
    };

    if (yaml.layout) {
      let layoutPath = yaml.layout;
      if (!path.isAbsolute(layoutPath)) {
        layoutPath = path.resolve(path.dirname(inputPath), layoutPath);
      }

      const layoutTmpl = await createComponentTemplateFromFile(layoutPath);
      const layoutVars = Object.assign(variables, {
        page: yaml,
        navigation,
        content: new handlebars.SafeString(compBundle.renderedTemplate),
      });

      const layoutBundle = await layoutTmpl.render(layoutVars);

      compBundle.renderedTemplate = layoutBundle.renderedTemplate;
      compBundle.styles.append(layoutBundle.styles);
      compBundle.scripts.append(layoutBundle.scripts);
    }
    
    // tslint:disable-next-line:no-any
    const topLevelTemplate = (compTmpl.yaml as any)['template'] ? (compTmpl.yaml as any)['template'] : 'default.tmpl';
    const themeFile = path.join(config.theme.root, topLevelTemplate);
    const wrappingTemplate = await createHTMLTemplateFromFile(themeFile);

    // Wrapping template will be the template that displays the styles etc
    // so copy template styles and scripts over
    wrappingTemplate.styles.append(compBundle.styles); // TODO: This was previous prepend, should it still be prepend?
    wrappingTemplate.scripts.append(compBundle.scripts);

    let htmlTags: string[] = [];
    if (yaml.elements) {
      htmlTags.push(...yaml.elements);
    }
    if (compBundle.elements) {
      htmlTags.push(...compBundle.elements);
    }
    htmlTags.push(...getHTMLTags(compBundle.renderedTemplate));
    htmlTags.push(...getHTMLTags(wrappingTemplate.content));

    const reduced: string[] = [];
    for (const t of htmlTags) {
      if (reduced.indexOf(t) === -1) {
        reduced.push(t);
      }
    }

    htmlTags = reduced;

    for (const t of htmlTags) {
      const tokenAssets = config.tokenAssets[t];
      if (!tokenAssets) {
        continue;
      }

      if (tokenAssets.styles) {
        const styles = tokenAssets.styles;
        if (styles.inline) {
            for (const filePath of styles.inline) {
                const buffer = await fs.readFile(filePath);
                wrappingTemplate.styles.inline.add(filePath, buffer.toString());
            }
        }
        if (styles.sync) {
            for (const filePath of styles.sync) {
                wrappingTemplate.styles.sync.add(filePath, filePath);
            }
        }
        if (styles.async) {
          for (const filePath of styles.async) {
            wrappingTemplate.styles.async.add(filePath, filePath);
          }
        }
      }

      if (tokenAssets.scripts) {
        const scripts = tokenAssets.scripts;
        if (scripts.inline) {
            for (const filePath of scripts.inline) {
                const buffer = await fs.readFile(filePath);
                wrappingTemplate.scripts.inline.add(filePath, {
                  src: buffer.toString(),
                  type: path.extname(filePath) === '.mjs' ? 'module' : 'nomodule',
                });
            }
        }
        if (scripts.sync) {
            for (const filePath of scripts.sync) {
                wrappingTemplate.scripts.sync.add(filePath, filePath);
            }
        }
        if (scripts.async) {
          for (const filePath of scripts.async) {
            wrappingTemplate.scripts.async.add(filePath, filePath);
          }
        }
      }
    }

    if (config.styles) {
      const styles = config.styles;
      if (styles.inline) {
          for (const filePath of styles.inline) {
              const buffer = await fs.readFile(filePath);
              wrappingTemplate.styles.inline.add(filePath, buffer.toString());
          }
      }
      if (styles.sync) {
          for (const filePath of styles.sync) {
              wrappingTemplate.styles.sync.add(filePath, filePath);
          }
      }
      if (styles.async) {
        for (const filePath of styles.async) {
          wrappingTemplate.styles.async.add(filePath, filePath);
        }
      }
    }

    // Finally render the content in the wrapping template
    const wrappedHTML = await wrappingTemplate.render(compBundle, {
      navigation,
      page: compTmpl.yaml,
    });


    const relativePath = path.relative(config.contentPath, inputPath);

    // replace .md with .html
    const relPathPieces = path.parse(relativePath);
    delete relPathPieces.base;
    relPathPieces.ext = '.html';

    const outputPath = path.join(config.outputPath, path.format(relPathPieces));
    await fs.mkdirp(path.dirname(outputPath));
    await fs.writeFile(outputPath, wrappedHTML);

    return {
        result: {
            inputPath,
            outputPath,
        }
    };
  } catch (err) {
    logger.error('File Processor run failed.');
    logger.error(err);
    return {
        error: `Unable to read and parse: ${err.message}`,
    };
  }
}

export async function start(args: string[], config: InternalConfig, variables: {}, navigation: {[id: string]: NavNode[]} = {}): Promise<Message> {
    if (args.length !== 3) {
        logger.warn('Unexpected number of process args passed to file-processor: ', process.argv);
        return {
            error: `Unexpected number of process args: ${JSON.stringify(process.argv)}`,
        };
    }

    return run(args[2], config, variables, navigation);
}

function getHTMLTags(html: string): string[] {
  const root = parse(html);
  if (root.nodeType !== NodeType.ELEMENT_NODE) {
    return [];
  }

  const tags: string[] = [];
  const htmlRoot = root as HTMLElement;
  if (htmlRoot.tagName) {
    tags.push(htmlRoot.tagName);
  }
  for (const c of htmlRoot.childNodes) {
    const ts = getHTMLTokensFromNode(c);
    tags.push(...ts);
  }
  return tags;
}

function getHTMLTokensFromNode(node: Node): string[] {
  if (node.nodeType !== NodeType.ELEMENT_NODE) {
    return [];
  }

  const tags: string[] = [];
  const htmlNode = node as HTMLElement;
  if (htmlNode.tagName) {
    tags.push(htmlNode.tagName);
  }
  for (const c of htmlNode.childNodes) {
    const ts = getHTMLTokensFromNode(c);
    tags.push(...ts);
  }
  return tags;
}

async function standardizeHTML(html: string, staticDir: string): Promise<string> {
  const result = parse(html, {
    script: true,
    style: true,
    pre: true,
  });

  const parsedHTML = result as HTMLElement;

  // Wrap iframes with utility divs
  // Clean YouTube attribues and URL
  // Set src to data-src
  // Add loading=lazy
  cleanIframes(parsedHTML);

  // Set src to data-src for gifs
  // Add loading=lazy
  await cleanImgs(parsedHTML, staticDir);

  await cleanPictures(parsedHTML, staticDir);

  // Set src to data-src
  await cleanVideos(parsedHTML);

  return parsedHTML.toString();
}

function cleanIframes(parsedHTML: HTMLElement) {
  const iframeElements = parsedHTML.querySelectorAll('iframe');
  for (const iframeElement of iframeElements) {
    const newAttribs = Object.assign({}, iframeElement.attributes);
    const iframeSrc = newAttribs.src;
    if (iframeSrc) {
      newAttribs['data-src'] = iframeSrc;
      delete newAttribs.src;
      newAttribs.loading = 'lazy';
    }

    const extraClasses: string[] = [];
    try {
      const parsedURL = new URL(iframeSrc);
      if (parsedURL.hostname.indexOf('youtube.') !== -1) {
        extraClasses.push('__hopin__u-ratio-container--16-9');
        parsedURL.search = '?modestbranding=1';
        newAttribs['data-src'] = parsedURL.toString();
      }
    } catch (err) {
      // NOOP
    }

    delete newAttribs.style;

    const newIframe = new HTMLElement('iframe', {}, createAttributesString(newAttribs));
    newIframe.childNodes = iframeElement.childNodes;

    const ratioElement = createAspectRatioElement(newIframe, extraClasses);

    replaceElement(iframeElement, ratioElement, parsedHTML);
  }
}

async function cleanImgs(parsedHTML: HTMLElement, staticDir: string) {
  const imgElements = parsedHTML.querySelectorAll('img');
  for (const imgElement of imgElements) {
    const newAttribs = Object.assign({}, imgElement.attributes);
    const imgURL = newAttribs.src;
    if (imgURL) {
      newAttribs['data-src'] = imgURL;
      delete newAttribs.src;
    }
    newAttribs.loading = 'lazy';

    const dimens = await getImageDimens(imgElement, staticDir);
    if (dimens) {
      newAttribs.width = dimens.width.toString();
      newAttribs.height = dimens.height.toString();
    }

    let imgReplacement = new HTMLElement('img', {}, createAttributesString(newAttribs));
    const parent = imgElement.parentNode as HTMLElement;
    if (dimens && parent.tagName !== 'picture') {
      imgReplacement = createAspectRatioElement(imgReplacement);
    }

    replaceElement(imgElement, imgReplacement, parsedHTML);
  }
}

async function cleanPictures(parsedHTML: HTMLElement, staticDir: string) {
  const picElements = parsedHTML.querySelectorAll('picture');
  for (const picElement of picElements) {
    const newAttribs = Object.assign({}, picElement.attributes);
    
    const imgElement = picElement.querySelector('img');
    const dimens = await getImageDimens(imgElement, staticDir);
    if (dimens) {
      newAttribs.width = dimens.width.toString();
      newAttribs.height = dimens.height.toString();
    }

    let picReplacement = new HTMLElement('picture', {}, createAttributesString(newAttribs));
    picReplacement.childNodes = picElement.childNodes;
    if (dimens) {
      picReplacement = createAspectRatioElement(picReplacement);
    }

    replaceElement(picElement, picReplacement, parsedHTML);
  }
}

async function getImageDimens(img: HTMLElement, staticDir: string): Promise<{width: number, height: number} | null> {
  let width: number;
  let height: number;

  // First get from attributes
  if (img.attributes.width) {
    width = Number(img.attributes.width);
  }
  if (img.attributes.height) {
    height = Number(img.attributes.height);
  }
  if (width && height) {
    return {width, height};
  }

  // Get from Local or HTTP request
  const imgURL  = img.attributes.src;
  try {
    if (imgURL.indexOf('http') !== 0) {
      // Try and read the image and get the size of it
      const dimens = sizeOf(path.join(staticDir, imgURL));
      width = dimens.width;
      height = dimens.height;
    } else {
      const dimens = await dimensForImageURL(imgURL);
      width = dimens.width;
      height = dimens.height;
    }
  } catch (err) {
    // NOOP
  }

  if (width && height) {
    return {width, height};
  }

  return null;
}

function dimensForImageURL(imgURL: string): Promise<{width: number, height: number}> {
  return new Promise((resolve, reject) => {
    const getFunc = imgURL.indexOf('https') === 0 ? https.get : http.get;
    const req = getFunc(imgURL, (response) => {
      // tslint:disable-next-line:no-any
      const chunks: any[] = [];
      response.on('data', (chunk) => {
        chunks.push(chunk);
        try {
          const dimens = sizeOf(Buffer.concat(chunks));
          req.abort();
          return resolve(dimens);
        } catch (err) {
          // NOOP
        }
      });
      response.on('end', () => {
        reject(new Error(`Failed to find dimensions for image url: ${imgURL}`));
      });
    }).on('error', (e) => {
      reject(new Error(`Request failed for image url: ${imgURL}`));
    });
  });
}

function cleanVideos(parsedHTML: HTMLElement) {
  const videoElements = parsedHTML.querySelectorAll('video');
  for (const videoElement of videoElements) {
    for (const c of videoElement.childNodes) {
      let child = c as HTMLElement;
      if (child.attributes) {
        const videoURL = child.attributes.src;
        if (videoURL) {
          child.attributes['data-src'] = videoURL;
          delete child.attributes.src;
        }
        child = new HTMLElement(child.tagName, {}, createAttributesString(child.attributes));
      }
      videoElement.exchangeChild(c, child);
    }

    const videoReplacement = new HTMLElement('video', {}, createAttributesString(videoElement.attributes));
    videoReplacement.childNodes = videoElement.childNodes;

    const aspectRatioElement = createAspectRatioElement(videoReplacement);
    replaceElement(videoElement, aspectRatioElement, parsedHTML);
  }
}

function createAspectRatioElement(elementToScale: HTMLElement, extraClasses?: string[]): HTMLElement {
  const containerAttributes:{[key: string]: string} = {
    class: '__hopin__u-ratio-container',
  };
  const wrapperAttributes:{[key: string]: string} = {
    class: '__hopin__u-ratio-container__wrapper',
  };

  if (extraClasses) {
    for (const c of extraClasses) {
      containerAttributes.class += ` ${c}`;
    }
  }

  // If the object provides a ratio, use it
  if (elementToScale.attributes.width && elementToScale.attributes.height) {
    containerAttributes.class += ' __hopin__u-ratio-container--is-sized';
    containerAttributes.style = `max-width: ${Number(elementToScale.attributes.width)}px`;
    wrapperAttributes.style = `padding-bottom: ${(Number(elementToScale.attributes.height) / Number(elementToScale.attributes.width)) * 100}%`;
  }

  const innerWrapper = new HTMLElement('div', {}, createAttributesString(wrapperAttributes));
  innerWrapper.appendChild(elementToScale);
  const outerContainer = new HTMLElement('div', {}, createAttributesString(containerAttributes));
  outerContainer.appendChild(innerWrapper);
  return outerContainer;
}

// Replace element is silly and only replaces top level children.
function replaceElement(oldEle: HTMLElement, newEle: HTMLElement, html: HTMLElement) {
  if (!oldEle.parentNode) {
    html.exchangeChild(oldEle, newEle);
    return;
  } 

  for (let i = 0; i < oldEle.parentNode.childNodes.length; i++) {
    if (oldEle.parentNode.childNodes[i] === oldEle) {
      oldEle.parentNode.childNodes[i] = newEle;
    }
  }
}

function createAttributesString(attributes: {[key:string]: string}): string {
  const attribStrings = Object.keys(attributes).map((key) => {
    if (!attributes[key]) {
      return key;
    }
    return `${key}="${attributes[key]}"`;
  });
  return attribStrings.join(' ');
}

let isRunning = false;
// tslint:disable-next-line:no-any
process.on('message', (msg: any) => {
  switch(msg.name) {
    case RUN_WITH_DETAILS_MSG: {
      if (isRunning) {
          logger.warn('File processor already running, ignoring msg: ', msg);
          return;
      }

      isRunning = true;
      start(process.argv, msg.config, msg.variables, msg.navigation).then((msg) => {
        process.send(msg);
        process.exit(0);
      })
      .catch((err) => {
        process.send({error: err});
        process.exit(0);
      });
    }
    default: {
      // NOOP
    }
  }
});

// Ensure we are running within 1s
setTimeout(() => {
    if (isRunning) {
        return;
    }

    process.send({
        error: 'Timed out waiting for config.'
    });
    process.exit(0);
}, 1000);
