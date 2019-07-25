'use babel';

import { CompositeDisposable } from 'atom';

export default {

    currentTooltip: null,
    currentNode: null,

    activate(state) {
        this.initMouseListeners();
    },

    deactivate() {
        this.removeMouseListeners();
    },

    initMouseListeners() {
        document.body.addEventListener('mouseover', this.mouseMoveCallback.bind(this));
    },

    removeMouseListeners() {
        document.body.removeEventListener('mouseover', this.mouseMoveCallback.bind(this));
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
        const cachedContent = localStorage.getItem('phpdochover_' + name);

        if (cachedContent) {
            if (cachedContent != 'NONE') {
                this.currentTooltip = atom.tooltips.add(functionNameNode, { title: cachedContent, trigger: 'manual' });
            }
        } else {
            const context = this;
            const documentationUrl = 'https://php.net/manual/en/function.' + name.replace('_', '-') + '.php';

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
                        <div class="phpdochover-definition">
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

                    context.currentTooltip = atom.tooltips.add(functionNameNode, { title: content, trigger: 'manual' });
                } else {
                    console.warning(`No definition could be found for PHP function "${name}"`);
                    localStorage.setItem('phpdochover_' + name, 'NONE');
                }
            }).catch(() => {
                // Nothing to do here
            });
        }
    },

    removeCurrentTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.dispose();
            this.currentTooltip = null;
        }
    }

};
