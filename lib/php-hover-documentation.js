'use babel';

import { CompositeDisposable } from 'atom';

export default {

    currentTooltip: null,
    currentNode: null,
    orphanedTooltipsCallback: null,

    activate(state) {
        this.initMouseListeners();
    },

    deactivate() {
        this.removeMouseListeners();
    },

    initMouseListeners() {
        document.body.addEventListener('mouseover', this.mouseMoveCallback.bind(this));
        this.orphanedTooltipsCallback = setInterval(this.removeOrphanedTooltips.bind(this), 1000);
    },

    removeMouseListeners() {
        document.body.removeEventListener('mouseover', this.mouseMoveCallback.bind(this));
        clearInterval(this.orphanedTooltipsCallback);
    },

    mouseMoveCallback(e) {
        // Only run for PHP function definitions
        if (!e.target.matches('.syntax--function-call.syntax--php .syntax--function')) {
            this.removeCurrentTooltip();
            this.currentNode = null;
            return;
        }

        const functionNameNode = e.target;

        // Check if we're already displaying the definition of this node
        if (!functionNameNode || this.currentNode == functionNameNode) {
            return;
        }

        this.currentNode = functionNameNode;
        this.removeCurrentTooltip();

        // Fetch the definition from PHP's documentation
        const name = functionNameNode.innerHTML.trim();
        const context = this;

        this.getTooltipContent(name).then((content) => {
            if (typeof content != 'undefined' && content && content != 'NONE') {
                context.currentTooltip = atom.tooltips.add(functionNameNode, { title: content, trigger: 'manual', delay: 0 });
            }
        });
    },

    removeOrphanedTooltips() {
        for (const node of document.querySelectorAll('.phpdochover-definition')) {
            if (typeof this.currentNode == 'undefined' || !this.currentNode || node.getAttribute('function-name') != this.currentNode.textContent.trim()) {
                node.closest('.tooltip').remove();
            }
        }
    },

    removeCurrentTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.dispose();
            this.currentTooltip = null;
        }
    },

    getTooltipContent(name) {
        const context = this;

        return new Promise((resolve, reject) => {
            const cachedContent = localStorage.getItem('phpdochover_' + name);

            if (cachedContent) {
                resolve(cachedContent);
            } else {
                context.getPhpDefinition(name).then((content) => {
                    resolve(content);
                }).catch(() => {
                    context.getWordpressDefinition(name).then((content) => {
                        resolve(content);
                    }).catch(() => {
                        localStorage.setItem('phpdochover_' + name, 'NONE');
                        resolve('NONE');
                    });
                });
            }
        });
    },

    getPhpDefinition(name) {
        const documentationUrl = 'https://php.net/manual/en/function.' + name.replace('_', '-') + '.php';

        return new Promise((resolve, reject) => {
            fetch(documentationUrl).then((response) => {
                return response.ok ? response.text() : null;
            }).then((html) => {
                if (html) {
                    const parser = new DOMParser();
                    const htmlDocument = parser.parseFromString(html, "text/html");
                    const shortDescriptionNode = htmlDocument.documentElement.querySelector('.dc-title');
                    const shortDescription = shortDescriptionNode ? shortDescriptionNode.textContent.trim() : '';
                    const definitionHtml = htmlDocument.documentElement.querySelector('.methodsynopsis.dc-description').innerHTML;
                    const longDescriptionNodes = htmlDocument.documentElement.querySelectorAll('.description .para');
                    let longDescription = '';

                    for (const node of longDescriptionNodes) {
                        longDescription += `<p>${node.textContent.trim()}</p>`;
                    }

                    const content = `
                        <div class="phpdochover-definition" function-name="${name}">
                            <div class="definition">
                                ${definitionHtml}
                            </div>
                            <div class="short-description">
                                ${shortDescription}
                            </div>
                            <div class="long-description">
                                ${longDescription}
                            </div>
                        </div>
                    `;

                    localStorage.setItem('phpdochover_' + name, content);

                    resolve(content);
                } else {
                    reject();
                }
            });
        });
    },

    getWordpressDefinition(name) {
        const documentationUrl = 'https://developer.wordpress.org/reference/functions/' + name + '/';

        return new Promise((resolve, reject) => {
            fetch(documentationUrl).then((response) => {
                return response.ok ? response.text() : null;
            }).then((html) => {
                if (html) {
                    const parser = new DOMParser();
                    const htmlDocument = parser.parseFromString(html, "text/html");
                    const definitionHtml = htmlDocument.documentElement.querySelector('main h1').innerHTML;
                    const shortDescriptionNode = htmlDocument.documentElement.querySelector('section.summary');
                    const shortDescription = shortDescriptionNode ? shortDescriptionNode.textContent.trim() : '';

                    const content = `
                        <div class="phpdochover-definition wordpress" function-name="${name}">
                            <div class="definition">
                                ${definitionHtml}
                            </div>
                            <div class="short-description">
                                ${shortDescription}
                            </div>
                            <div class="wordpress-label">Wordpress function</div>
                        </div>
                    `;

                    localStorage.setItem('phpdochover_' + name, content);

                    resolve(content);
                } else {
                    reject();
                }
            });
        });
    }
};
