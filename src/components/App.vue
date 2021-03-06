<template>
    <div
        :class="{
            'kiwi-wrap--statebrowser-drawopen': stateBrowserDrawOpen,
            'kiwi-wrap--monospace': $state.setting('useMonospace'),
            'kiwi-wrap--touch': $state.ui.is_touch,
        }"
        :data-activebuffer="buffer ? buffer.name.toLowerCase() : ''"
        class="kiwi-wrap kiwi-theme-bg"
        @click="emitDocumentClick"
        @paste.capture="emitBufferPaste"
    >
        <link :href="themeUrl" rel="stylesheet" type="text/css">

        <template v-if="!hasStarted || (!fallbackComponent && networks.length === 0)">
            <component :is="startupComponent" @start="startUp"/>
        </template>
        <template v-else>
            <state-browser :networks="networks" :sidebar-state="sidebarState"/>
            <div class="kiwi-workspace" @click="stateBrowserDrawOpen = false">
                <div class="kiwi-workspace-background"/>

                <template v-if="!activeComponent && network">
                    <container
                        :network="network"
                        :buffer="buffer"
                        :sidebar-state="sidebarState"
                    >
                        <media-viewer
                            v-if="mediaviewerOpen"
                            slot="before"
                            :url="mediaviewerUrl"
                            :component="mediaviewerComponent"
                            :is-iframe="mediaviewerIframe"
                        />
                    </container>
                    <control-input :container="networks" :buffer="buffer"/>
                </template>
                <component
                    v-else-if="!activeComponent"
                    :is="fallbackComponent"
                    v-bind="fallbackComponentProps"
                />
                <component v-else :is="activeComponent" v-bind="activeComponentProps"/>
            </div>
        </template>
    </div>
</template>

<script>
'kiwi public';

import 'font-awesome-webpack';
import '@/res/globalStyle.css';
import Tinycon from 'tinycon';

import startupWelcome from '@/components/startups/Welcome';
import startupZncLogin from '@/components/startups/ZncLogin';
import startupCustomServer from '@/components/startups/CustomServer';
import startupKiwiBnc from '@/components/startups/KiwiBnc';
import startupPersonal from '@/components/startups/Personal';
import StateBrowser from '@/components/StateBrowser';
import AppSettings from '@/components/AppSettings';
import Container from '@/components/Container';
import ControlInput from '@/components/ControlInput';
import MediaViewer from '@/components/MediaViewer';
import { State as SidebarState } from '@/components/Sidebar';
import * as Notifications from '@/libs/Notifications';
import * as bufferTools from '@/libs/bufferTools';
import ThemeManager from '@/libs/ThemeManager';
import Logger from '@/libs/Logger';

let log = Logger.namespace('App.vue');

export default {
    components: {
        StateBrowser,
        Container,
        ControlInput,
        MediaViewer,
    },
    data() {
        return {
            startupComponent: null,
            hasStarted: false,
            // When on mobile screens, the statebrowser turns into a drawer
            stateBrowserDrawOpen: false,
            // If set, will become the main view instead of a buffer/nicklist container
            activeComponent: null,
            activeComponentProps: {},
            // If set, will become the main view when no networks are available to be shown
            // and there is no active component set
            fallbackComponent: null,
            fallbackComponentProps: {},
            mediaviewerOpen: false,
            mediaviewerUrl: '',
            mediaviewerComponent: null,
            mediaviewerIframe: false,
            themeUrl: '',
            sidebarState: new SidebarState(),
        };
    },
    computed: {
        networks() {
            return this.$state.networks;
        },
        network() {
            return this.$state.getActiveNetwork();
        },
        buffer() {
            return this.$state.getActiveBuffer();
        },
    },
    created() {
        this.listenForActiveComponents();
        this.watchForThemes();
        this.initStateBrowser();
        this.initMediaviewer();
        this.configureFavicon();

        document.addEventListener('keydown', event => this.onKeyDown(event), false);
        window.addEventListener('focus', event => this.onFocus(event), false);
        window.addEventListener('blur', event => this.onBlur(event), false);
        window.addEventListener('touchstart', event => this.onTouchStart(event));
    },
    mounted() {
        // Decide which startup screen to use depending on the config
        let startupScreens = {
            welcome: startupWelcome,
            customServer: startupCustomServer,
            kiwiBnc: startupKiwiBnc,
            znc: startupZncLogin,
            personal: startupPersonal,
        };
        let extraStartupScreens = this.$state.getStartups();

        let startupName = this.$state.settings.startupScreen || 'personal';
        let startup = extraStartupScreens[startupName] || startupScreens[startupName];

        if (!startup) {
            Logger.error(`Startup screen "${startupName}" does not exist`);
        } else {
            this.startupComponent = startup;
        }
        this.trackWindowDimensions();
    },
    methods: {
        // Triggered by a startup screen event
        startUp(opts) {
            log('startUp()');
            if (opts && opts.fallbackComponent) {
                this.fallbackComponent = opts.fallbackComponent;
            }
            if (opts && opts.fallbackComponentProps) {
                this.fallbackComponentProps = opts.fallbackComponentProps;
            }

            // Make sure a startup screen can't trigger these more than once
            if (!this.hasStarted) {
                this.warnOnPageClose();
                Notifications.requestPermission();
                Notifications.listenForNewMessages(this.$state);
            }

            this.hasStarted = true;
        },
        listenForActiveComponents() {
            this.listen(this.$state, 'active.component', (component, props) => {
                this.activeComponent = null;
                if (component) {
                    this.activeComponentProps = props;
                    this.activeComponent = component;
                }
            });
        },
        watchForThemes() {
            let themes = ThemeManager.instance();
            this.themeUrl = ThemeManager.themeUrl(themes.currentTheme());
            this.listen(this.$state, 'theme.change', () => {
                this.themeUrl = ThemeManager.themeUrl(themes.currentTheme());
            });
        },
        initStateBrowser() {
            this.listen(this.$state, 'statebrowser.toggle', () => {
                this.stateBrowserDrawOpen = !this.stateBrowserDrawOpen;
            });
            this.listen(this.$state, 'statebrowser.show', () => {
                this.stateBrowserDrawOpen = true;
            });
            this.listen(this.$state, 'statebrowser.hide', () => {
                this.stateBrowserDrawOpen = false;
            });
        },
        initMediaviewer() {
            this.listen(this.$state, 'mediaviewer.show', (url) => {
                let opts = {};

                // The passed url may be a string or an options object
                if (typeof url === 'string') {
                    opts = { url: url };
                } else {
                    opts = url;
                }

                this.mediaviewerUrl = opts.url;
                this.mediaviewerComponent = opts.component;
                this.mediaviewerIframe = opts.iframe;
                this.mediaviewerOpen = true;
            });

            this.listen(this.$state, 'mediaviewer.hide', () => {
                this.mediaviewerOpen = false;
            });
        },
        configureFavicon() {
            // favicon bubble
            Tinycon.setOptions({
                width: 7,
                height: 9,
                color: '#ffffff',
                background: '#b32d2d',
                fallback: true,
            });

            this.$state.$watch('ui.favicon_counter', (newVal) => {
                if (newVal) {
                    Tinycon.setBubble(newVal);
                } else {
                    Tinycon.reset();
                }
            });

            this.listen(this.$state, 'message.new', (message) => {
                if (!message.isHighlight || message.ignore || this.$state.ui.app_has_focus) {
                    return;
                }

                this.$state.ui.favicon_counter++;
            });
        },
        trackWindowDimensions() {
            // Track the window dimensions into the reactive ui state
            let trackWindowDims = () => {
                this.$state.ui.app_width = this.$el.clientWidth;
                this.$state.ui.app_height = this.$el.clientHeight;
            };
            window.addEventListener('resize', trackWindowDims);
            trackWindowDims();
        },
        warnOnPageClose() {
            window.onbeforeunload = () => {
                if (this.$state.setting('warnOnExit')) {
                    return this.$t('window_unload');
                }

                return undefined;
            };
        },
        emitBufferPaste(event) {
            // bail if no buffer is active, or the buffer is hidden by another component
            if (!this.$state.getActiveBuffer() || this.activeComponent !== null) {
                return;
            }

            // bail if the target is an input-like element
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLSelectElement ||
                event.target instanceof HTMLTextAreaElement
            ) {
                return;
            }

            this.$state.$emit('buffer.paste', event);
        },
        emitDocumentClick(event) {
            this.$state.$emit('document.clicked', event);
        },
        onTouchStart(event) {
            // Parts of the UI adjust themselves if we're known to be using a touchscreen
            this.$state.ui.is_touch = true;
        },
        onBlur(event) {
            this.$state.ui.app_has_focus = false;
        },
        onFocus(event) {
            this.$state.ui.app_has_focus = true;
            let buffer = this.$state.getActiveBuffer();
            if (buffer) {
                buffer.markAsRead(true);
            }

            this.$state.ui.favicon_counter = 0;
        },
        onKeyDown(event) {
            this.$state.$emit('document.keydown', event);

            let meta = false;

            if (navigator.appVersion.indexOf('Mac') !== -1) {
                meta = event.metaKey;
            } else {
                meta = event.ctrlKey;
            }

            if (meta && event.keyCode === 221) {
                // meta + ]
                let buffer = bufferTools.getNextBuffer();
                if (buffer) {
                    this.$state.setActiveBuffer(buffer.networkid, buffer.name);
                }
                event.preventDefault();
            } else if (meta && event.keyCode === 219) {
                // meta + [
                let buffer = bufferTools.getPreviousBuffer();
                if (buffer) {
                    this.$state.setActiveBuffer(buffer.networkid, buffer.name);
                }
                event.preventDefault();
            } else if (meta && event.keyCode === 79) {
                // meta + o
                this.$state.$emit('active.component', AppSettings);
                event.preventDefault();
            } else if (meta && event.keyCode === 83) {
                // meta + s
                let network = this.$state.getActiveNetwork();
                if (network) {
                    network.showServerBuffer('settings');
                }
                event.preventDefault();
            }
        },
    },
};
</script>

<style lang="less">
html {
    height: 100%;
    margin: 0;
    padding: 0;
}

body {
    height: 100%;
    margin: 0;
    padding: 0;
}

.kiwi-wrap {
    font-size: 90%;
    line-height: 1.6em;
    font-family: Source Sans Pro, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    height: 100%;
    overflow: hidden;
}

.kiwi-wrap--monospace {
    font-family: Consolas, monaco, monospace;
    font-size: 80%;
}

.kiwi-workspace {
    position: relative;
    margin-left: 220px;
    left: 0;
    display: block;
    height: 100%;
    transition: left 0.2s, margin-left 0.2s;
}

.kiwi-workspace::before {
    position: absolute;
    content: '';
    right: 0;
    left: 0;
    top: 0;
    height: 7px;
    z-index: 0;
}

/* When the statebrowser opens as a draw, darken the workspace */
.kiwi-workspace::after {
    position: fixed;
    top: 0;
    right: 0;
    content: '';
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.5s;
    will-change: opacity;
}

.kiwi-workspace-background {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
    z-index: -1;
}

.kiwi-statebrowser {
    position: absolute;
    top: 0;
    left: 0;
    width: 200px;
    bottom: 0;
    transition: left 0.2s;
    z-index: 1;
}

.kiwi-container {
    position: absolute;
    top: 0;
    bottom: 40px;
    width: 100%;
}

.kiwi-mediaviewer {
    max-height: 70%;
    overflow: auto;
}

.kiwi-controlinput {
    position: absolute;
    bottom: 0;
    height: 40px;
    width: 100%;
    z-index: 2;
}

/* Small screen will cause the statebrowser to act as a drawer */
@media screen and (max-width: 769px) {
    .kiwi-workspace {
        left: 0;
        margin-left: 0;
    }

    .kiwi-statebrowser {
        left: -200px;
    }

    .kiwi-wrap--statebrowser-drawopen .kiwi-statebrowser {
        left: 0;
    }

    .kiwi-wrap--statebrowser-drawopen .kiwi-workspace {
        left: 75%;
        width: 80%;
    }

    .kiwi-wrap--statebrowser-drawopen .kiwi-workspace::after {
        width: 100%;
        height: 100%;
        opacity: 1;
        z-index: 10;
    }
}
</style>
