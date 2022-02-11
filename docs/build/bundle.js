
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element.sheet;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    const managed_styles = new Map();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_style_information(doc, node) {
        const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
        managed_styles.set(doc, info);
        return info;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
        if (!rules[name]) {
            rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            managed_styles.forEach(info => {
                const { stylesheet } = info;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                info.rules = {};
            });
            managed_styles.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                started = true;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = (program.b - t);
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.46.2' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function cubicInOut(t) {
        return t < 0.5 ? 4.0 * t * t * t : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
    }
    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function blur(node, { delay = 0, duration = 400, easing = cubicInOut, amount = 5, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const f = style.filter === 'none' ? '' : style.filter;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (_t, u) => `opacity: ${target_opacity - (od * u)}; filter: ${f} blur(${u * amount}px);`
        };
    }
    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }
    function scale(node, { delay = 0, duration = 400, easing = cubicOut, start = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const sd = 1 - start;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (_t, u) => `
			transform: ${transform} scale(${1 - (sd * u)});
			opacity: ${target_opacity - (od * u)}
		`
        };
    }

    /* src\components\Modal.svelte generated by Svelte v3.46.2 */
    const file$a = "src\\components\\Modal.svelte";

    // (27:0) {#if isOpenModal}
    function create_if_block$4(ctx) {
    	let div4;
    	let div3;
    	let div0;
    	let t0;
    	let t1;
    	let t2;
    	let div1;
    	let t3;
    	let t4;
    	let div2;
    	let div4_class_value;
    	let div4_transition;
    	let current;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			t0 = text(/*typeText*/ ctx[3]);
    			t1 = text("?");
    			t2 = space();
    			div1 = element("div");
    			t3 = text(/*titleText*/ ctx[2]);
    			t4 = space();
    			div2 = element("div");
    			attr_dev(div0, "class", "cardType svelte-s2uep7");
    			add_location(div0, file$a, 29, 6, 681);
    			attr_dev(div1, "class", "title svelte-s2uep7");
    			add_location(div1, file$a, 30, 6, 728);
    			attr_dev(div2, "class", "bodyText svelte-s2uep7");
    			add_location(div2, file$a, 31, 6, 772);
    			attr_dev(div3, "class", "modal svelte-s2uep7");
    			add_location(div3, file$a, 28, 4, 654);
    			attr_dev(div4, "id", "frame");
    			attr_dev(div4, "class", div4_class_value = "" + (null_to_empty(/*cardType*/ ctx[4]) + " svelte-s2uep7"));
    			add_location(div4, file$a, 27, 2, 598);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div3, t2);
    			append_dev(div3, div1);
    			append_dev(div1, t3);
    			append_dev(div3, t4);
    			append_dev(div3, div2);
    			div2.innerHTML = /*bodyText*/ ctx[1];
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*typeText*/ 8) set_data_dev(t0, /*typeText*/ ctx[3]);
    			if (!current || dirty & /*titleText*/ 4) set_data_dev(t3, /*titleText*/ ctx[2]);
    			if (!current || dirty & /*bodyText*/ 2) div2.innerHTML = /*bodyText*/ ctx[1];
    			if (!current || dirty & /*cardType*/ 16 && div4_class_value !== (div4_class_value = "" + (null_to_empty(/*cardType*/ ctx[4]) + " svelte-s2uep7"))) {
    				attr_dev(div4, "class", div4_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!div4_transition) div4_transition = create_bidirectional_transition(div4, scale, {}, true);
    				div4_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!div4_transition) div4_transition = create_bidirectional_transition(div4, scale, {}, false);
    			div4_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			if (detaching && div4_transition) div4_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(27:0) {#if isOpenModal}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
    	let div;
    	let t;
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*isOpenModal*/ ctx[0] && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(div, "id", "background");
    			set_style(div, "display", /*isOpenModal*/ ctx[0] ? 'block' : 'none');
    			attr_dev(div, "class", "svelte-s2uep7");
    			add_location(div, file$a, 19, 0, 457);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			insert_dev(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(div, "click", /*closeModal*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*isOpenModal*/ 1) {
    				set_style(div, "display", /*isOpenModal*/ ctx[0] ? 'block' : 'none');
    			}

    			if (/*isOpenModal*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*isOpenModal*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Modal', slots, []);
    	let { isOpenModal } = $$props;
    	let { bodyText = "" } = $$props;
    	let { titleText = "" } = $$props;
    	let { typeText = "" } = $$props;
    	let { cardType = "" } = $$props;
    	const dispatch = createEventDispatcher();

    	function closeModal() {
    		$$invalidate(0, isOpenModal = false);
    		dispatch("closeModal", { isOpenModal });
    	}

    	const writable_props = ['isOpenModal', 'bodyText', 'titleText', 'typeText', 'cardType'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('isOpenModal' in $$props) $$invalidate(0, isOpenModal = $$props.isOpenModal);
    		if ('bodyText' in $$props) $$invalidate(1, bodyText = $$props.bodyText);
    		if ('titleText' in $$props) $$invalidate(2, titleText = $$props.titleText);
    		if ('typeText' in $$props) $$invalidate(3, typeText = $$props.typeText);
    		if ('cardType' in $$props) $$invalidate(4, cardType = $$props.cardType);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		fly,
    		fade,
    		scale,
    		isOpenModal,
    		bodyText,
    		titleText,
    		typeText,
    		cardType,
    		dispatch,
    		closeModal
    	});

    	$$self.$inject_state = $$props => {
    		if ('isOpenModal' in $$props) $$invalidate(0, isOpenModal = $$props.isOpenModal);
    		if ('bodyText' in $$props) $$invalidate(1, bodyText = $$props.bodyText);
    		if ('titleText' in $$props) $$invalidate(2, titleText = $$props.titleText);
    		if ('typeText' in $$props) $$invalidate(3, typeText = $$props.typeText);
    		if ('cardType' in $$props) $$invalidate(4, cardType = $$props.cardType);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [isOpenModal, bodyText, titleText, typeText, cardType, closeModal];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {
    			isOpenModal: 0,
    			bodyText: 1,
    			titleText: 2,
    			typeText: 3,
    			cardType: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment$c.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*isOpenModal*/ ctx[0] === undefined && !('isOpenModal' in props)) {
    			console.warn("<Modal> was created without expected prop 'isOpenModal'");
    		}
    	}

    	get isOpenModal() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isOpenModal(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get bodyText() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bodyText(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get titleText() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set titleText(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get typeText() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set typeText(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get cardType() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set cardType(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var refactorCards = [
    	{
    		id: "1",
    		title: "Helper Methods",
    		description: "Use helper methods with descriptive names to wrap low-level code, so that your code reads as much like natural language as possible.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/R-1"
    	},
    	{
    		id: "2",
    		title: "Create Constants",
    		description: "Literal values embedded in your production code are a form of technical debt. Define literals as constants with names that make their meaning explicit.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/R-2"
    	},
    	{
    		id: "3",
    		title: "Refactor When Beneficial",
    		description: "Refactor when you see an obvious code quality problem and a clear solution.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/R-3"
    	},
    	{
    		id: "4",
    		title: "Refactor Test Code Too",
    		description: "Remember that test code is code, too, and should also be refactored to keep the design clean and the tests readable.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/R-4"
    	},
    	{
    		id: "5",
    		title: "Remove Duplicate Code",
    		description: "Duplicated code can indicate a missing design concept. Keep code readable and flexible by wrapping and removing duplicated code using helper methods.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/R-5"
    	},
    	{
    		id: "6",
    		title: "Refactoring Not Mandatory",
    		description: "It's mandatory to look for refactoring opportunities in each red-green-green cycle. It is not mandatory to actually refactor. Do so only when the benefits are clear.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/R-6"
    	},
    	{
    		id: "7",
    		title: "Rewrite Constants",
    		description: "Rewriting a constant in your production code with an expression in terms of other constants can help to reveal underlying patterns.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/R-7"
    	},
    	{
    		id: "8",
    		title: "Wait Till Benefits Clear",
    		description: "If you're not sure whether a particular refactoring will improve things, then leave it. Later test cases may make the benefits clearer.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/R-8"
    	},
    	{
    		id: "9",
    		title: "Generalise to Loop",
    		description: "Replace if-statements describing how to process 0, 1, 2 and 3 items with a loop showing how to process N items.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/R-9"
    	},
    	{
    		id: "10",
    		title: "Generaise from a pattern",
    		description: "Refactor when you see a pattern in the code that you can generalise so that more examples of the behaviour described by your test cases can be handled.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/R-10"
    	}
    ];

    var testCards = [
    	{
    		id: "1",
    		title: "Simplest Happy Path Test",
    		description: "Choose the simplest 'Happy Path' case for your first test",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/T-1"
    	},
    	{
    		id: "2",
    		title: "Simplest Next Test",
    		description: "Always aim to write the simplest test you can think of that will fail against the current production code.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/T-2"
    	},
    	{
    		id: "3",
    		title: "Assertion First",
    		description: "Stuck when writing a test? Try writing the assertion first, and filling in backwards from there..",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/T-3"
    	},
    	{
    		id: "4",
    		title: " Test Case Method Names",
    		description: "A handy trick for naming unit test methods is to start them with the word “should” and follow with a description of the requirement that is being tested.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/T-4"
    	},
    	{
    		id: "5",
    		title: "Use Boundary Values",
    		description: "Write test cases at the boundaries of the different types of behaviour that you need to support.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/T-5"
    	},
    	{
    		id: "6",
    		title: "Finish Feature Groups",
    		description: "The order in which you tackle the tests is important. Finish all the tests in one feature group before moving on to a new one.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/T-6"
    	},
    	{
    		id: "7",
    		title: "Sad Path Tests",
    		description: "Write test cases for sad path cases, too. We expect good quality code to deal gracefully with unexpected and invalid cases, too. And, in TDD, that means we must write test cases to cover these requirements.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/T-7"
    	}
    ];

    var codeCards = [
    	{
    		id: "1",
    		title: "Simplest Implementation",
    		description: "Take the simplest route to making the current failing test pass. So, in the code step, we want to write production code that does exactly what the new test asks for, no more than that and no less.  We want to match the specification, as given by the test suite, as closely as we can.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/C-1"
    	},
    	{
    		id: "2",
    		title: "Hardcode the Result",
    		description: "If you have just one test case, the simplest way to make it pass is to hard-code its expected result as the return value of the method under test.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/C-2"
    	},
    	{
    		id: "3",
    		title: "Use If-Statements",
    		description: "Use if-statements to allow the production code to return two or three different hard-coded results, satisfying two or three tests quickly.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/C-3"
    	},
    	{
    		id: "4",
    		title: "Generalise Existing Code",
    		description: "To get back to green quickly, look for parts of the existing code that can also handle your new case, if generalised appropriately. In the code step of the TDD cycle, we are looking to make a small set of changes to the code that will cause the test we have just written to pass. We aren't concerned with making the code beautiful and elegant, as we are in the refactoring step. We just need to get back to a green test result as fast and as simply as we can. In TDD, we try to write tests that tackle very closely related functionalities, one after another. Therefore, it is often the case that the code we need to implement is more or less already written, because it was needed for the previous test case. And this previous test case is very similar to the current test case, except that it is slightly simpler.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/C-4"
    	},
    	{
    		id: "5",
    		title: "Keep Distinct Code Separate",
    		description: "When implementing a case that is quite different from anything the code currently does, try to keep the new code clearly separate from the old code.",
    		url: "https://github.com/redgreengo/Red-Green-Go/wiki/C-5"
    	}
    ];

    /* src\components\HintCard.svelte generated by Svelte v3.46.2 */

    const { console: console_1$4 } = globals;

    function create_fragment$b(ctx) {
    	let modal;
    	let current;

    	modal = new Modal({
    			props: {
    				isOpenModal: /*show*/ ctx[1],
    				cardType: /*cardType*/ ctx[0],
    				titleText: /*titleText*/ ctx[3],
    				bodyText: /*bodyText*/ ctx[2],
    				typeText: /*typeText*/ ctx[4]
    			},
    			$$inline: true
    		});

    	modal.$on("closeModal", /*closeModal*/ ctx[5]);

    	const block = {
    		c: function create() {
    			create_component(modal.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(modal, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const modal_changes = {};
    			if (dirty & /*show*/ 2) modal_changes.isOpenModal = /*show*/ ctx[1];
    			if (dirty & /*cardType*/ 1) modal_changes.cardType = /*cardType*/ ctx[0];
    			if (dirty & /*titleText*/ 8) modal_changes.titleText = /*titleText*/ ctx[3];
    			if (dirty & /*bodyText*/ 4) modal_changes.bodyText = /*bodyText*/ ctx[2];
    			if (dirty & /*typeText*/ 16) modal_changes.typeText = /*typeText*/ ctx[4];
    			modal.$set(modal_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modal.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modal.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(modal, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('HintCard', slots, []);
    	let { showHint = false } = $$props;
    	let { cardType = "" } = $$props;

    	const allCards = {
    		refactor: refactorCards,
    		test: testCards,
    		code: codeCards
    	};

    	const typeTexts = {
    		refactor: "REFACTOR?",
    		test: "TEST!",
    		code: "IMPLEMENTATION!"
    	};

    	let show = false;
    	let bodyText = "";
    	let titleText = "";
    	let typeText = "";

    	function closeModal() {
    		$$invalidate(1, show = false);
    	}

    	const writable_props = ['showHint', 'cardType'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$4.warn(`<HintCard> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('showHint' in $$props) $$invalidate(6, showHint = $$props.showHint);
    		if ('cardType' in $$props) $$invalidate(0, cardType = $$props.cardType);
    	};

    	$$self.$capture_state = () => ({
    		Modal,
    		refactorCards,
    		testCards,
    		codeCards,
    		showHint,
    		cardType,
    		allCards,
    		typeTexts,
    		show,
    		bodyText,
    		titleText,
    		typeText,
    		closeModal
    	});

    	$$self.$inject_state = $$props => {
    		if ('showHint' in $$props) $$invalidate(6, showHint = $$props.showHint);
    		if ('cardType' in $$props) $$invalidate(0, cardType = $$props.cardType);
    		if ('show' in $$props) $$invalidate(1, show = $$props.show);
    		if ('bodyText' in $$props) $$invalidate(2, bodyText = $$props.bodyText);
    		if ('titleText' in $$props) $$invalidate(3, titleText = $$props.titleText);
    		if ('typeText' in $$props) $$invalidate(4, typeText = $$props.typeText);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*cardType, showHint*/ 65) {
    			{
    				const cards = allCards[cardType];

    				if (cards) {
    					if (showHint) $$invalidate(1, show = true);
    					$$invalidate(4, typeText = typeTexts[cardType]);
    					let idx = Math.round((cards.length - 1) * Math.random());
    					console.log(idx);
    					let card = cards[idx];
    					$$invalidate(2, bodyText = card.description);
    					$$invalidate(3, titleText = card.title);
    				}
    			}
    		}
    	};

    	return [cardType, show, bodyText, titleText, typeText, closeModal, showHint];
    }

    class HintCard extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, { showHint: 6, cardType: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "HintCard",
    			options,
    			id: create_fragment$b.name
    		});
    	}

    	get showHint() {
    		throw new Error("<HintCard>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showHint(value) {
    		throw new Error("<HintCard>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get cardType() {
    		throw new Error("<HintCard>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set cardType(value) {
    		throw new Error("<HintCard>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Solutions.svelte generated by Svelte v3.46.2 */

    const { console: console_1$3 } = globals;

    function create_fragment$a(ctx) {
    	const block = {
    		c: noop,
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Solutions', slots, []);
    	let htmlDoc;
    	let { dataReady = false } = $$props;
    	origin = window.location.href;
    	if (!origin || origin == "null") origin = "http://localhost:8080/";
    	let endpoint = origin + "content/fizzbuzz.html";

    	function getStepText(iteration, step) {
    		if (!dataReady) {
    			return "";
    		}

    		console.log(iteration, " ", step);
    		const selector = "article#loop" + iteration + " section." + step;
    		const section = htmlDoc.querySelector(selector);
    		console.log(section);
    		return section ? section.innerHTML : "";
    	}

    	onMount(async function () {
    		const response = await fetch(endpoint);
    		let raw = await response.text();
    		var parser = new DOMParser();
    		htmlDoc = parser.parseFromString(raw, "text/html");
    		$$invalidate(0, dataReady = true);
    	});

    	const writable_props = ['dataReady'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$3.warn(`<Solutions> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('dataReady' in $$props) $$invalidate(0, dataReady = $$props.dataReady);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		htmlDoc,
    		dataReady,
    		endpoint,
    		getStepText
    	});

    	$$self.$inject_state = $$props => {
    		if ('htmlDoc' in $$props) htmlDoc = $$props.htmlDoc;
    		if ('dataReady' in $$props) $$invalidate(0, dataReady = $$props.dataReady);
    		if ('endpoint' in $$props) endpoint = $$props.endpoint;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [dataReady, getStepText];
    }

    class Solutions extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { dataReady: 0, getStepText: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Solutions",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get dataReady() {
    		throw new Error("<Solutions>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dataReady(value) {
    		throw new Error("<Solutions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getStepText() {
    		return this.$$.ctx[1];
    	}

    	set getStepText(value) {
    		throw new Error("<Solutions>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\ModalContainer.svelte generated by Svelte v3.46.2 */
    const file$9 = "src\\components\\ModalContainer.svelte";

    // (22:0) {#if isOpenModal}
    function create_if_block$3(ctx) {
    	let div1;
    	let div0;
    	let div1_transition;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div0, "class", "modal svelte-1qm8wzo");
    			add_location(div0, file$9, 23, 4, 501);
    			attr_dev(div1, "id", "frame");
    			attr_dev(div1, "class", "svelte-1qm8wzo");
    			add_location(div1, file$9, 22, 2, 462);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);

    			if (default_slot) {
    				default_slot.m(div0, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[2],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[2])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, scale, {}, true);
    				div1_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, scale, {}, false);
    			div1_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (default_slot) default_slot.d(detaching);
    			if (detaching && div1_transition) div1_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(22:0) {#if isOpenModal}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div;
    	let t;
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*isOpenModal*/ ctx[0] && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(div, "id", "background");
    			set_style(div, "display", /*isOpenModal*/ ctx[0] ? 'block' : 'none');
    			attr_dev(div, "class", "svelte-1qm8wzo");
    			add_location(div, file$9, 14, 0, 321);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			insert_dev(target, t, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(div, "click", /*closeModal*/ ctx[1], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*isOpenModal*/ 1) {
    				set_style(div, "display", /*isOpenModal*/ ctx[0] ? 'block' : 'none');
    			}

    			if (/*isOpenModal*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*isOpenModal*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ModalContainer', slots, ['default']);
    	let { isOpenModal = false } = $$props;
    	const dispatch = createEventDispatcher();

    	function closeModal() {
    		$$invalidate(0, isOpenModal = false);
    		dispatch("closeModal", { isOpenModal });
    	}

    	const writable_props = ['isOpenModal'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ModalContainer> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('isOpenModal' in $$props) $$invalidate(0, isOpenModal = $$props.isOpenModal);
    		if ('$$scope' in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		fly,
    		fade,
    		scale,
    		isOpenModal,
    		dispatch,
    		closeModal
    	});

    	$$self.$inject_state = $$props => {
    		if ('isOpenModal' in $$props) $$invalidate(0, isOpenModal = $$props.isOpenModal);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [isOpenModal, closeModal, $$scope, slots];
    }

    class ModalContainer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { isOpenModal: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ModalContainer",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get isOpenModal() {
    		throw new Error("<ModalContainer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isOpenModal(value) {
    		throw new Error("<ModalContainer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Card.svelte generated by Svelte v3.46.2 */

    const { console: console_1$2 } = globals;
    const file$8 = "src\\components\\Card.svelte";

    function create_fragment$8(ctx) {
    	let div8;
    	let div7;
    	let div1;
    	let div0;
    	let h1;
    	let t1;
    	let p0;
    	let t2;
    	let br;
    	let t3;
    	let p1;
    	let div1_class_value;
    	let t5;
    	let div6;
    	let div5;
    	let div2;
    	let t6;
    	let t7;
    	let t8;
    	let div3;
    	let t9;
    	let t10;
    	let div4;
    	let div6_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div8 = element("div");
    			div7 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Testing Inspiration Card";
    			t1 = space();
    			p0 = element("p");
    			t2 = text("Stuck?");
    			br = element("br");
    			t3 = space();
    			p1 = element("p");
    			p1.textContent = "One of these cards might give you an idea to move forward";
    			t5 = space();
    			div6 = element("div");
    			div5 = element("div");
    			div2 = element("div");
    			t6 = text(/*typeText*/ ctx[4]);
    			t7 = text("?");
    			t8 = space();
    			div3 = element("div");
    			t9 = text(/*titleText*/ ctx[3]);
    			t10 = space();
    			div4 = element("div");
    			attr_dev(h1, "class", "svelte-dih8ta");
    			add_location(h1, file$8, 55, 8, 1355);
    			attr_dev(br, "class", "svelte-dih8ta");
    			add_location(br, file$8, 56, 17, 1407);
    			attr_dev(p0, "class", "svelte-dih8ta");
    			add_location(p0, file$8, 56, 8, 1398);
    			attr_dev(p1, "class", "svelte-dih8ta");
    			add_location(p1, file$8, 57, 8, 1427);
    			attr_dev(div0, "class", "content svelte-dih8ta");
    			add_location(div0, file$8, 54, 6, 1324);
    			attr_dev(div1, "class", div1_class_value = "" + (null_to_empty("flip-card-front " + /*cardType*/ ctx[0]) + " svelte-dih8ta"));
    			add_location(div1, file$8, 50, 4, 1213);
    			attr_dev(div2, "class", "cardType svelte-dih8ta");
    			add_location(div2, file$8, 66, 8, 1681);
    			attr_dev(div3, "class", "title svelte-dih8ta");
    			add_location(div3, file$8, 67, 8, 1730);
    			attr_dev(div4, "class", "bodyText svelte-dih8ta");
    			add_location(div4, file$8, 68, 8, 1776);
    			attr_dev(div5, "class", "modal svelte-dih8ta");
    			add_location(div5, file$8, 65, 6, 1652);
    			attr_dev(div6, "class", div6_class_value = "" + (null_to_empty("flip-card-back " + /*cardType*/ ctx[0]) + " svelte-dih8ta"));
    			attr_dev(div6, "id", "frame");
    			add_location(div6, file$8, 60, 4, 1523);
    			attr_dev(div7, "class", "flip-card-inner svelte-dih8ta");
    			add_location(div7, file$8, 49, 2, 1178);
    			attr_dev(div8, "class", "flip-card svelte-dih8ta");
    			set_style(div8, "--mv", /*mv*/ ctx[5]);
    			toggle_class(div8, "flipCardTwist", /*flipCardTwist*/ ctx[1]);
    			add_location(div8, file$8, 48, 0, 1111);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div8, anchor);
    			append_dev(div8, div7);
    			append_dev(div7, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(div0, t1);
    			append_dev(div0, p0);
    			append_dev(p0, t2);
    			append_dev(p0, br);
    			append_dev(div0, t3);
    			append_dev(div0, p1);
    			append_dev(div7, t5);
    			append_dev(div7, div6);
    			append_dev(div6, div5);
    			append_dev(div5, div2);
    			append_dev(div2, t6);
    			append_dev(div2, t7);
    			append_dev(div5, t8);
    			append_dev(div5, div3);
    			append_dev(div3, t9);
    			append_dev(div5, t10);
    			append_dev(div5, div4);
    			div4.innerHTML = /*bodyText*/ ctx[2];

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "click", /*click_handler*/ ctx[8], false, false, false),
    					listen_dev(div6, "click", /*click_handler_1*/ ctx[9], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*cardType*/ 1 && div1_class_value !== (div1_class_value = "" + (null_to_empty("flip-card-front " + /*cardType*/ ctx[0]) + " svelte-dih8ta"))) {
    				attr_dev(div1, "class", div1_class_value);
    			}

    			if (dirty & /*typeText*/ 16) set_data_dev(t6, /*typeText*/ ctx[4]);
    			if (dirty & /*titleText*/ 8) set_data_dev(t9, /*titleText*/ ctx[3]);
    			if (dirty & /*bodyText*/ 4) div4.innerHTML = /*bodyText*/ ctx[2];
    			if (dirty & /*cardType*/ 1 && div6_class_value !== (div6_class_value = "" + (null_to_empty("flip-card-back " + /*cardType*/ ctx[0]) + " svelte-dih8ta"))) {
    				attr_dev(div6, "class", div6_class_value);
    			}

    			if (dirty & /*flipCardTwist*/ 2) {
    				toggle_class(div8, "flipCardTwist", /*flipCardTwist*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div8);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Card', slots, []);
    	let flipCardTwist = false;
    	let { off = 0 } = $$props;
    	let mv = off + "px";
    	let { showHint = false } = $$props;
    	let { cardType = "" } = $$props;

    	const allCards = {
    		refactor: refactorCards,
    		test: testCards,
    		code: codeCards
    	};

    	const typeTexts = {
    		refactor: "REFACTOR?",
    		test: "TEST!",
    		code: "IMPLEMENTATION!"
    	};

    	let show = false;
    	let bodyText = "";
    	let titleText = "";
    	let typeText = "";

    	function closeModal() {
    		show = false;
    	}

    	const writable_props = ['off', 'showHint', 'cardType'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<Card> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(1, flipCardTwist = true);
    	const click_handler_1 = () => $$invalidate(1, flipCardTwist = false);

    	$$self.$$set = $$props => {
    		if ('off' in $$props) $$invalidate(6, off = $$props.off);
    		if ('showHint' in $$props) $$invalidate(7, showHint = $$props.showHint);
    		if ('cardType' in $$props) $$invalidate(0, cardType = $$props.cardType);
    	};

    	$$self.$capture_state = () => ({
    		Modal,
    		refactorCards,
    		testCards,
    		codeCards,
    		flipCardTwist,
    		off,
    		mv,
    		showHint,
    		cardType,
    		allCards,
    		typeTexts,
    		show,
    		bodyText,
    		titleText,
    		typeText,
    		closeModal
    	});

    	$$self.$inject_state = $$props => {
    		if ('flipCardTwist' in $$props) $$invalidate(1, flipCardTwist = $$props.flipCardTwist);
    		if ('off' in $$props) $$invalidate(6, off = $$props.off);
    		if ('mv' in $$props) $$invalidate(5, mv = $$props.mv);
    		if ('showHint' in $$props) $$invalidate(7, showHint = $$props.showHint);
    		if ('cardType' in $$props) $$invalidate(0, cardType = $$props.cardType);
    		if ('show' in $$props) show = $$props.show;
    		if ('bodyText' in $$props) $$invalidate(2, bodyText = $$props.bodyText);
    		if ('titleText' in $$props) $$invalidate(3, titleText = $$props.titleText);
    		if ('typeText' in $$props) $$invalidate(4, typeText = $$props.typeText);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*cardType, flipCardTwist, showHint*/ 131) {
    			{
    				const cards = allCards[cardType];
    				(($$invalidate(1, flipCardTwist), $$invalidate(0, cardType)), $$invalidate(7, showHint));

    				if (cards) {
    					if (showHint) show = true;
    					$$invalidate(4, typeText = typeTexts[cardType]);
    					let idx = Math.round((cards.length - 1) * Math.random());
    					console.log(idx);
    					let card = cards[idx];
    					$$invalidate(2, bodyText = card.description);
    					$$invalidate(3, titleText = card.title);
    				}
    			}
    		}
    	};

    	return [
    		cardType,
    		flipCardTwist,
    		bodyText,
    		titleText,
    		typeText,
    		mv,
    		off,
    		showHint,
    		click_handler,
    		click_handler_1
    	];
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { off: 6, showHint: 7, cardType: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Card",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get off() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set off(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showHint() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showHint(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get cardType() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set cardType(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Icon.svelte generated by Svelte v3.46.2 */

    const file$7 = "src\\components\\Icon.svelte";

    function create_fragment$7(ctx) {
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let img_title_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			set_style(img, "--size", /*size*/ ctx[1]);
    			if (!src_url_equal(img.src, img_src_value = /*urls*/ ctx[2][/*icon*/ ctx[0]])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*alts*/ ctx[3][/*icon*/ ctx[0]]);
    			attr_dev(img, "title", img_title_value = /*alts*/ ctx[3][/*icon*/ ctx[0]]);
    			attr_dev(img, "class", "svelte-ditdal");
    			add_location(img, file$7, 19, 0, 384);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*size*/ 2) {
    				set_style(img, "--size", /*size*/ ctx[1]);
    			}

    			if (dirty & /*icon*/ 1 && !src_url_equal(img.src, img_src_value = /*urls*/ ctx[2][/*icon*/ ctx[0]])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*icon*/ 1 && img_alt_value !== (img_alt_value = /*alts*/ ctx[3][/*icon*/ ctx[0]])) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*icon*/ 1 && img_title_value !== (img_title_value = /*alts*/ ctx[3][/*icon*/ ctx[0]])) {
    				attr_dev(img, "title", img_title_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Icon', slots, []);
    	let { icon = "" } = $$props;
    	let { size = "20px" } = $$props;

    	let urls = {
    		restart: "icons/restart.png",
    		driving: "icons/driving.png",
    		navigation: "icons/navigation.png",
    		keyboard: "icons/keyboard.png"
    	};

    	let alts = {
    		restart: "Restart Game",
    		driving: "Driver",
    		navigation: "Navigator",
    		keyboard: "Keyboard"
    	};

    	const writable_props = ['icon', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Icon> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('icon' in $$props) $$invalidate(0, icon = $$props.icon);
    		if ('size' in $$props) $$invalidate(1, size = $$props.size);
    	};

    	$$self.$capture_state = () => ({ icon, size, urls, alts });

    	$$self.$inject_state = $$props => {
    		if ('icon' in $$props) $$invalidate(0, icon = $$props.icon);
    		if ('size' in $$props) $$invalidate(1, size = $$props.size);
    		if ('urls' in $$props) $$invalidate(2, urls = $$props.urls);
    		if ('alts' in $$props) $$invalidate(3, alts = $$props.alts);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [icon, size, urls, alts];
    }

    class Icon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { icon: 0, size: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Icon",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get icon() {
    		throw new Error("<Icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set icon(value) {
    		throw new Error("<Icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\TimedButton.svelte generated by Svelte v3.46.2 */
    const file$6 = "src\\components\\TimedButton.svelte";

    function create_fragment$6(ctx) {
    	let button;
    	let span0;
    	let t0;
    	let t1;
    	let div1;
    	let div0;
    	let svg;
    	let g;
    	let circle;
    	let path;
    	let t2;
    	let span1;
    	let t3_value = formatTime(/*timeLeft*/ ctx[1]) + "";
    	let t3;
    	let button_disabled_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			span0 = element("span");
    			t0 = text(/*text*/ ctx[0]);
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");
    			svg = svg_element("svg");
    			g = svg_element("g");
    			circle = svg_element("circle");
    			path = svg_element("path");
    			t2 = space();
    			span1 = element("span");
    			t3 = text(t3_value);
    			attr_dev(span0, "class", "svelte-vihkma");
    			add_location(span0, file$6, 92, 3, 2112);
    			attr_dev(circle, "class", "base-timer__path-elapsed svelte-vihkma");
    			attr_dev(circle, "cx", "50");
    			attr_dev(circle, "cy", "50");
    			attr_dev(circle, "r", "45");
    			add_location(circle, file$6, 101, 10, 2375);
    			attr_dev(path, "id", "base-timer-path-remaining");
    			attr_dev(path, "stroke-dasharray", "283");
    			attr_dev(path, "class", "base-timer__path-remaining svelte-vihkma");
    			attr_dev(path, "d", "\r\n                M 50, 50\r\n                m -45, 0\r\n                a 45,45 0 1,0 90,0\r\n                a 45,45 0 1,0 -90,0\r\n            ");
    			toggle_class(path, "red", /*red*/ ctx[3]);
    			toggle_class(path, "orange", /*orange*/ ctx[4]);
    			toggle_class(path, "green", /*green*/ ctx[5]);
    			add_location(path, file$6, 102, 10, 2453);
    			attr_dev(g, "class", "base-timer__circle svelte-vihkma");
    			add_location(g, file$6, 100, 8, 2333);
    			attr_dev(svg, "class", "base-timer__svg svelte-vihkma");
    			attr_dev(svg, "viewBox", "0 0 100 100");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg, file$6, 95, 6, 2202);
    			attr_dev(span1, "id", "base-timer-label");
    			attr_dev(span1, "class", "base-timer__label svelte-vihkma");
    			add_location(span1, file$6, 118, 6, 2867);
    			attr_dev(div0, "class", "base-timer svelte-vihkma");
    			add_location(div0, file$6, 94, 4, 2170);
    			attr_dev(div1, "class", "clock-container svelte-vihkma");
    			add_location(div1, file$6, 93, 2, 2135);
    			button.disabled = button_disabled_value = !/*timeUp*/ ctx[2];
    			attr_dev(button, "class", "svelte-vihkma");
    			add_location(button, file$6, 91, 0, 2039);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, span0);
    			append_dev(span0, t0);
    			append_dev(button, t1);
    			append_dev(button, div1);
    			append_dev(div1, div0);
    			append_dev(div0, svg);
    			append_dev(svg, g);
    			append_dev(g, circle);
    			append_dev(g, path);
    			append_dev(div0, t2);
    			append_dev(div0, span1);
    			append_dev(span1, t3);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[7], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*text*/ 1) set_data_dev(t0, /*text*/ ctx[0]);

    			if (dirty & /*red*/ 8) {
    				toggle_class(path, "red", /*red*/ ctx[3]);
    			}

    			if (dirty & /*orange*/ 16) {
    				toggle_class(path, "orange", /*orange*/ ctx[4]);
    			}

    			if (dirty & /*green*/ 32) {
    				toggle_class(path, "green", /*green*/ ctx[5]);
    			}

    			if (dirty & /*timeLeft*/ 2 && t3_value !== (t3_value = formatTime(/*timeLeft*/ ctx[1]) + "")) set_data_dev(t3, t3_value);

    			if (dirty & /*timeUp*/ 4 && button_disabled_value !== (button_disabled_value = !/*timeUp*/ ctx[2])) {
    				prop_dev(button, "disabled", button_disabled_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const FULL_DASH_ARRAY = 283;
    const WARNING_THRESHOLD = 10;
    const ALERT_THRESHOLD = 5;
    const TIME_LIMIT = 12;

    function formatTime(time) {
    	const minutes = Math.floor(time / 60);
    	let seconds = time % 60;

    	if (seconds < 10) {
    		seconds = `0${seconds}`;
    	}

    	return `${minutes}:${seconds}`;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TimedButton', slots, []);
    	const dispatch = createEventDispatcher();

    	const COLOR_CODES = {
    		info: { color: "red" },
    		warning: {
    			color: "orange",
    			threshold: WARNING_THRESHOLD
    		},
    		alert: {
    			color: "green",
    			threshold: ALERT_THRESHOLD
    		}
    	};

    	let { text = "OK" } = $$props;
    	let timePassed = 0;
    	let timeLeft = TIME_LIMIT;
    	let timerInterval = null;
    	let timeUp = false;
    	let red = false;
    	let orange = false;
    	let green = true;
    	startTimer();

    	function onTimesUp() {
    		clearInterval(timerInterval);
    		$$invalidate(2, timeUp = true);
    	}

    	function startTimer() {
    		timerInterval = setInterval(
    			() => {
    				timePassed = timePassed += 1;
    				$$invalidate(1, timeLeft = TIME_LIMIT - timePassed);
    				setCircleDasharray();
    				setRemainingPathColor(timeLeft);

    				if (timeLeft === 0) {
    					onTimesUp();
    				}
    			},
    			1000
    		);
    	}

    	function setRemainingPathColor(timeLeft) {
    		const { alert, warning, info } = COLOR_CODES;

    		if (timeLeft <= alert.threshold) {
    			$$invalidate(4, orange = false);
    			$$invalidate(3, red = true);
    		} else if (timeLeft <= warning.threshold) {
    			$$invalidate(5, green = false);
    			$$invalidate(4, orange = true);
    		}
    	}

    	function calculateTimeFraction() {
    		const rawTimeFraction = timeLeft / TIME_LIMIT;
    		return rawTimeFraction - 1 / TIME_LIMIT * (1 - rawTimeFraction);
    	}

    	function setCircleDasharray() {
    		const circleDasharray = `${(calculateTimeFraction() * FULL_DASH_ARRAY).toFixed(0)} 283`;
    		document.getElementById("base-timer-path-remaining").setAttribute("stroke-dasharray", circleDasharray);
    	}

    	const writable_props = ['text'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TimedButton> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => dispatch("solution", "");

    	$$self.$$set = $$props => {
    		if ('text' in $$props) $$invalidate(0, text = $$props.text);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		FULL_DASH_ARRAY,
    		WARNING_THRESHOLD,
    		ALERT_THRESHOLD,
    		COLOR_CODES,
    		text,
    		TIME_LIMIT,
    		timePassed,
    		timeLeft,
    		timerInterval,
    		timeUp,
    		red,
    		orange,
    		green,
    		onTimesUp,
    		startTimer,
    		formatTime,
    		setRemainingPathColor,
    		calculateTimeFraction,
    		setCircleDasharray
    	});

    	$$self.$inject_state = $$props => {
    		if ('text' in $$props) $$invalidate(0, text = $$props.text);
    		if ('timePassed' in $$props) timePassed = $$props.timePassed;
    		if ('timeLeft' in $$props) $$invalidate(1, timeLeft = $$props.timeLeft);
    		if ('timerInterval' in $$props) timerInterval = $$props.timerInterval;
    		if ('timeUp' in $$props) $$invalidate(2, timeUp = $$props.timeUp);
    		if ('red' in $$props) $$invalidate(3, red = $$props.red);
    		if ('orange' in $$props) $$invalidate(4, orange = $$props.orange);
    		if ('green' in $$props) $$invalidate(5, green = $$props.green);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [text, timeLeft, timeUp, red, orange, green, dispatch, click_handler];
    }

    class TimedButton extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { text: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TimedButton",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get text() {
    		throw new Error("<TimedButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set text(value) {
    		throw new Error("<TimedButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Step.svelte generated by Svelte v3.46.2 */

    const { console: console_1$1 } = globals;
    const file$5 = "src\\components\\Step.svelte";

    // (92:4) <ModalContainer bind:isOpenModal>
    function create_default_slot(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			set_style(div, "background", "white");
    			add_location(div, file$5, 92, 6, 2618);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			div.innerHTML = /*solutionHTML*/ ctx[4];
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*solutionHTML*/ 16) div.innerHTML = /*solutionHTML*/ ctx[4];		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(92:4) <ModalContainer bind:isOpenModal>",
    		ctx
    	});

    	return block;
    }

    // (53:0) {#key step}
    function create_key_block(ctx) {
    	let div6;
    	let p0;
    	let t0_value = /*step*/ ctx[0].title + "";
    	let t0;
    	let t1;
    	let div5;
    	let div3;
    	let div0;
    	let card0;
    	let t2;
    	let card1;
    	let t3;
    	let card2;
    	let t4;
    	let card3;
    	let t5;
    	let div2;
    	let p1;
    	let t6_value = /*step*/ ctx[0].bodyText + "";
    	let t6;
    	let t7;
    	let div1;
    	let icon0;
    	let span0;
    	let t8_value = /*step*/ ctx[0].driver + "";
    	let t8;
    	let t9;
    	let t10;
    	let span1;
    	let t11;
    	let icon1;
    	let span2;
    	let t12_value = /*step*/ ctx[0].navigator + "";
    	let t12;
    	let t13;
    	let t14;
    	let div4;
    	let button;
    	let t15_value = /*step*/ ctx[0].buttonText + "";
    	let t15;
    	let t16;
    	let timedbutton;
    	let t17;
    	let modalcontainer;
    	let updating_isOpenModal;
    	let div6_class_value;
    	let div6_intro;
    	let div6_outro;
    	let current;
    	let mounted;
    	let dispose;

    	card0 = new Card({
    			props: {
    				off: 12,
    				cardType: /*step*/ ctx[0].helpName,
    				showHint: /*showHint*/ ctx[5]
    			},
    			$$inline: true
    		});

    	card1 = new Card({
    			props: {
    				off: 8,
    				cardType: /*step*/ ctx[0].helpName
    			},
    			$$inline: true
    		});

    	card2 = new Card({
    			props: {
    				off: 4,
    				cardType: /*step*/ ctx[0].helpName
    			},
    			$$inline: true
    		});

    	card3 = new Card({
    			props: {
    				off: 0,
    				cardType: /*step*/ ctx[0].helpName
    			},
    			$$inline: true
    		});

    	icon0 = new Icon({
    			props: { icon: "keyboard" },
    			$$inline: true
    		});

    	icon1 = new Icon({
    			props: { icon: "navigation" },
    			$$inline: true
    		});

    	timedbutton = new TimedButton({
    			props: { text: "Solution" },
    			$$inline: true
    		});

    	timedbutton.$on("solution", /*showSolution*/ ctx[8]);

    	function modalcontainer_isOpenModal_binding(value) {
    		/*modalcontainer_isOpenModal_binding*/ ctx[10](value);
    	}

    	let modalcontainer_props = {
    		$$slots: { default: [create_default_slot] },
    		$$scope: { ctx }
    	};

    	if (/*isOpenModal*/ ctx[3] !== void 0) {
    		modalcontainer_props.isOpenModal = /*isOpenModal*/ ctx[3];
    	}

    	modalcontainer = new ModalContainer({
    			props: modalcontainer_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modalcontainer, 'isOpenModal', modalcontainer_isOpenModal_binding));

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			p0 = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			div5 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			create_component(card0.$$.fragment);
    			t2 = space();
    			create_component(card1.$$.fragment);
    			t3 = space();
    			create_component(card2.$$.fragment);
    			t4 = space();
    			create_component(card3.$$.fragment);
    			t5 = space();
    			div2 = element("div");
    			p1 = element("p");
    			t6 = text(t6_value);
    			t7 = space();
    			div1 = element("div");
    			create_component(icon0.$$.fragment);
    			span0 = element("span");
    			t8 = text(t8_value);
    			t9 = text(" is the driver");
    			t10 = space();
    			span1 = element("span");
    			t11 = space();
    			create_component(icon1.$$.fragment);
    			span2 = element("span");
    			t12 = text(t12_value);
    			t13 = text(" is the navigator");
    			t14 = space();
    			div4 = element("div");
    			button = element("button");
    			t15 = text(t15_value);
    			t16 = space();
    			create_component(timedbutton.$$.fragment);
    			t17 = space();
    			create_component(modalcontainer.$$.fragment);
    			attr_dev(p0, "class", "title svelte-wc9c2u");
    			add_location(p0, file$5, 59, 4, 1350);
    			attr_dev(div0, "class", "cardDeck svelte-wc9c2u");
    			add_location(div0, file$5, 63, 8, 1458);
    			attr_dev(p1, "class", "svelte-wc9c2u");
    			add_location(p1, file$5, 70, 10, 1767);
    			attr_dev(span0, "class", "svelte-wc9c2u");
    			add_location(span0, file$5, 72, 36, 1844);
    			set_style(span1, "display", "inline-block");
    			set_style(span1, "width", "2em");
    			attr_dev(span1, "class", "svelte-wc9c2u");
    			add_location(span1, file$5, 73, 12, 1899);
    			attr_dev(span2, "class", "svelte-wc9c2u");
    			add_location(span2, file$5, 74, 38, 1988);
    			add_location(div1, file$5, 71, 10, 1801);
    			add_location(div2, file$5, 69, 8, 1750);
    			set_style(div3, "display", "flex");
    			add_location(div3, file$5, 62, 6, 1421);
    			add_location(button, file$5, 81, 8, 2189);
    			set_style(div4, "display", "flex");
    			set_style(div4, "justify-content", "space-evenly");
    			add_location(div4, file$5, 80, 6, 2120);
    			attr_dev(div5, "class", "stepBody svelte-wc9c2u");
    			add_location(div5, file$5, 61, 4, 1391);
    			attr_dev(div6, "class", div6_class_value = "" + (null_to_empty(/*step*/ ctx[0].classes) + " svelte-wc9c2u"));
    			attr_dev(div6, "id", "theStep");
    			add_location(div6, file$5, 53, 2, 1224);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, p0);
    			append_dev(p0, t0);
    			append_dev(div6, t1);
    			append_dev(div6, div5);
    			append_dev(div5, div3);
    			append_dev(div3, div0);
    			mount_component(card0, div0, null);
    			append_dev(div0, t2);
    			mount_component(card1, div0, null);
    			append_dev(div0, t3);
    			mount_component(card2, div0, null);
    			append_dev(div0, t4);
    			mount_component(card3, div0, null);
    			append_dev(div3, t5);
    			append_dev(div3, div2);
    			append_dev(div2, p1);
    			append_dev(p1, t6);
    			append_dev(div2, t7);
    			append_dev(div2, div1);
    			mount_component(icon0, div1, null);
    			append_dev(div1, span0);
    			append_dev(span0, t8);
    			append_dev(span0, t9);
    			append_dev(div1, t10);
    			append_dev(div1, span1);
    			append_dev(div1, t11);
    			mount_component(icon1, div1, null);
    			append_dev(div1, span2);
    			append_dev(span2, t12);
    			append_dev(span2, t13);
    			append_dev(div5, t14);
    			append_dev(div5, div4);
    			append_dev(div4, button);
    			append_dev(button, t15);
    			append_dev(div4, t16);
    			mount_component(timedbutton, div4, null);
    			append_dev(div6, t17);
    			mount_component(modalcontainer, div6, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div0, "click", /*showCard*/ ctx[7], false, false, false),
    					listen_dev(button, "click", /*click_handler*/ ctx[9], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*step*/ 1) && t0_value !== (t0_value = /*step*/ ctx[0].title + "")) set_data_dev(t0, t0_value);
    			const card0_changes = {};
    			if (dirty & /*step*/ 1) card0_changes.cardType = /*step*/ ctx[0].helpName;
    			if (dirty & /*showHint*/ 32) card0_changes.showHint = /*showHint*/ ctx[5];
    			card0.$set(card0_changes);
    			const card1_changes = {};
    			if (dirty & /*step*/ 1) card1_changes.cardType = /*step*/ ctx[0].helpName;
    			card1.$set(card1_changes);
    			const card2_changes = {};
    			if (dirty & /*step*/ 1) card2_changes.cardType = /*step*/ ctx[0].helpName;
    			card2.$set(card2_changes);
    			const card3_changes = {};
    			if (dirty & /*step*/ 1) card3_changes.cardType = /*step*/ ctx[0].helpName;
    			card3.$set(card3_changes);
    			if ((!current || dirty & /*step*/ 1) && t6_value !== (t6_value = /*step*/ ctx[0].bodyText + "")) set_data_dev(t6, t6_value);
    			if ((!current || dirty & /*step*/ 1) && t8_value !== (t8_value = /*step*/ ctx[0].driver + "")) set_data_dev(t8, t8_value);
    			if ((!current || dirty & /*step*/ 1) && t12_value !== (t12_value = /*step*/ ctx[0].navigator + "")) set_data_dev(t12, t12_value);
    			if ((!current || dirty & /*step*/ 1) && t15_value !== (t15_value = /*step*/ ctx[0].buttonText + "")) set_data_dev(t15, t15_value);
    			const modalcontainer_changes = {};

    			if (dirty & /*$$scope, solutionHTML*/ 8208) {
    				modalcontainer_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_isOpenModal && dirty & /*isOpenModal*/ 8) {
    				updating_isOpenModal = true;
    				modalcontainer_changes.isOpenModal = /*isOpenModal*/ ctx[3];
    				add_flush_callback(() => updating_isOpenModal = false);
    			}

    			modalcontainer.$set(modalcontainer_changes);

    			if (!current || dirty & /*step*/ 1 && div6_class_value !== (div6_class_value = "" + (null_to_empty(/*step*/ ctx[0].classes) + " svelte-wc9c2u"))) {
    				attr_dev(div6, "class", div6_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card0.$$.fragment, local);
    			transition_in(card1.$$.fragment, local);
    			transition_in(card2.$$.fragment, local);
    			transition_in(card3.$$.fragment, local);
    			transition_in(icon0.$$.fragment, local);
    			transition_in(icon1.$$.fragment, local);
    			transition_in(timedbutton.$$.fragment, local);
    			transition_in(modalcontainer.$$.fragment, local);

    			add_render_callback(() => {
    				if (div6_outro) div6_outro.end(1);
    				div6_intro = create_in_transition(div6, fly, { delay: 300, y: 400, duration: 1000 });
    				div6_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card0.$$.fragment, local);
    			transition_out(card1.$$.fragment, local);
    			transition_out(card2.$$.fragment, local);
    			transition_out(card3.$$.fragment, local);
    			transition_out(icon0.$$.fragment, local);
    			transition_out(icon1.$$.fragment, local);
    			transition_out(timedbutton.$$.fragment, local);
    			transition_out(modalcontainer.$$.fragment, local);
    			if (div6_intro) div6_intro.invalidate();
    			div6_outro = create_out_transition(div6, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			destroy_component(card0);
    			destroy_component(card1);
    			destroy_component(card2);
    			destroy_component(card3);
    			destroy_component(icon0);
    			destroy_component(icon1);
    			destroy_component(timedbutton);
    			destroy_component(modalcontainer);
    			if (detaching && div6_outro) div6_outro.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block.name,
    		type: "key",
    		source: "(53:0) {#key step}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let previous_key = /*step*/ ctx[0];
    	let t;
    	let solutions;
    	let updating_dataReady;
    	let current;
    	let key_block = create_key_block(ctx);

    	function solutions_dataReady_binding(value) {
    		/*solutions_dataReady_binding*/ ctx[12](value);
    	}

    	let solutions_props = {};

    	if (/*dataReady*/ ctx[1] !== void 0) {
    		solutions_props.dataReady = /*dataReady*/ ctx[1];
    	}

    	solutions = new Solutions({ props: solutions_props, $$inline: true });
    	/*solutions_binding*/ ctx[11](solutions);
    	binding_callbacks.push(() => bind(solutions, 'dataReady', solutions_dataReady_binding));

    	const block = {
    		c: function create() {
    			key_block.c();
    			t = space();
    			create_component(solutions.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			key_block.m(target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(solutions, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*step*/ 1 && safe_not_equal(previous_key, previous_key = /*step*/ ctx[0])) {
    				group_outros();
    				transition_out(key_block, 1, 1, noop);
    				check_outros();
    				key_block = create_key_block(ctx);
    				key_block.c();
    				transition_in(key_block);
    				key_block.m(t.parentNode, t);
    			} else {
    				key_block.p(ctx, dirty);
    			}

    			const solutions_changes = {};

    			if (!updating_dataReady && dirty & /*dataReady*/ 2) {
    				updating_dataReady = true;
    				solutions_changes.dataReady = /*dataReady*/ ctx[1];
    				add_flush_callback(() => updating_dataReady = false);
    			}

    			solutions.$set(solutions_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(key_block);
    			transition_in(solutions.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(key_block);
    			transition_out(solutions.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			key_block.d(detaching);
    			if (detaching) detach_dev(t);
    			/*solutions_binding*/ ctx[11](null);
    			destroy_component(solutions, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function scrollIntoView() {
    	const el = document.getElementById("theStep");
    	if (!el) return;
    	el.scrollIntoView({ behavior: "smooth" });
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Step', slots, []);
    	const dispatch = createEventDispatcher();
    	let { step } = $$props;
    	let isOpenModal;
    	let solutionHTML = "";
    	let dataReady = false;
    	let st;
    	let showHint = false;

    	async function showCard() {
    		$$invalidate(5, showHint = true);
    		await tick();
    		$$invalidate(5, showHint = false);
    	}

    	async function showSolution() {
    		$$invalidate(3, isOpenModal = true);
    	}

    	const writable_props = ['step'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Step> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => dispatch("interact", "done");

    	function modalcontainer_isOpenModal_binding(value) {
    		isOpenModal = value;
    		$$invalidate(3, isOpenModal);
    	}

    	function solutions_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			st = $$value;
    			$$invalidate(2, st);
    		});
    	}

    	function solutions_dataReady_binding(value) {
    		dataReady = value;
    		$$invalidate(1, dataReady);
    	}

    	$$self.$$set = $$props => {
    		if ('step' in $$props) $$invalidate(0, step = $$props.step);
    	};

    	$$self.$capture_state = () => ({
    		HintCard,
    		Solutions,
    		ModalContainer,
    		Card,
    		fade,
    		fly,
    		blur,
    		scale,
    		tick,
    		createEventDispatcher,
    		Icon,
    		TimedButton,
    		dispatch,
    		step,
    		isOpenModal,
    		solutionHTML,
    		dataReady,
    		st,
    		showHint,
    		showCard,
    		showSolution,
    		scrollIntoView
    	});

    	$$self.$inject_state = $$props => {
    		if ('step' in $$props) $$invalidate(0, step = $$props.step);
    		if ('isOpenModal' in $$props) $$invalidate(3, isOpenModal = $$props.isOpenModal);
    		if ('solutionHTML' in $$props) $$invalidate(4, solutionHTML = $$props.solutionHTML);
    		if ('dataReady' in $$props) $$invalidate(1, dataReady = $$props.dataReady);
    		if ('st' in $$props) $$invalidate(2, st = $$props.st);
    		if ('showHint' in $$props) $$invalidate(5, showHint = $$props.showHint);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*step, dataReady, st*/ 7) {
    			{
    				console.log(step);
    				if (dataReady) $$invalidate(4, solutionHTML = st.getStepText(step.iteration + 1, step.stateName));
    			}
    		}
    	};

    	{
    		scrollIntoView(); //no state here, so does it ever get called?
    	}

    	return [
    		step,
    		dataReady,
    		st,
    		isOpenModal,
    		solutionHTML,
    		showHint,
    		dispatch,
    		showCard,
    		showSolution,
    		click_handler,
    		modalcontainer_isOpenModal_binding,
    		solutions_binding,
    		solutions_dataReady_binding
    	];
    }

    class Step extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { step: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Step",
    			options,
    			id: create_fragment$5.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*step*/ ctx[0] === undefined && !('step' in props)) {
    			console_1$1.warn("<Step> was created without expected prop 'step'");
    		}
    	}

    	get step() {
    		throw new Error("<Step>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set step(value) {
    		throw new Error("<Step>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\TDDCycle.svelte generated by Svelte v3.46.2 */

    const file$4 = "src\\components\\TDDCycle.svelte";

    // (56:4) {#if phase > 0}
    function create_if_block_4(ctx) {
    	let text_1;
    	let t;

    	const block = {
    		c: function create() {
    			text_1 = svg_element("text");
    			t = text(/*text*/ ctx[1]);
    			attr_dev(text_1, "x", "0");
    			attr_dev(text_1, "y", "0");
    			attr_dev(text_1, "transform", "translate(" + /*hsize*/ ctx[6] + " " + /*hsize*/ ctx[6] * 1.25 + ") scale(" + /*textScale*/ ctx[8] + "," + /*textScale*/ ctx[8] + ")");
    			set_style(text_1, "text-anchor", "middle");
    			add_location(text_1, file$4, 56, 6, 1325);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, text_1, anchor);
    			append_dev(text_1, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*text*/ 2) set_data_dev(t, /*text*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(text_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(56:4) {#if phase > 0}",
    		ctx
    	});

    	return block;
    }

    // (83:10) {#if phase == 1}
    function create_if_block_3(ctx) {
    	let animate;

    	const block = {
    		c: function create() {
    			animate = svg_element("animate");
    			attr_dev(animate, "attributeName", "fill");
    			attr_dev(animate, "values", "white;" + phase1Col + ";white");
    			attr_dev(animate, "dur", "3s");
    			attr_dev(animate, "repeatCount", "indefinite");
    			add_location(animate, file$4, 83, 12, 1984);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, animate, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(animate);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(83:10) {#if phase == 1}",
    		ctx
    	});

    	return block;
    }

    // (99:10) {#if phase == 2}
    function create_if_block_2(ctx) {
    	let animate;

    	const block = {
    		c: function create() {
    			animate = svg_element("animate");
    			attr_dev(animate, "attributeName", "fill");
    			attr_dev(animate, "values", "white;" + phase2Col + ";white");
    			attr_dev(animate, "dur", "3s");
    			attr_dev(animate, "repeatCount", "indefinite");
    			add_location(animate, file$4, 99, 12, 2381);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, animate, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(animate);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(99:10) {#if phase == 2}",
    		ctx
    	});

    	return block;
    }

    // (115:10) {#if phase == 3}
    function create_if_block_1(ctx) {
    	let animate;

    	const block = {
    		c: function create() {
    			animate = svg_element("animate");
    			attr_dev(animate, "attributeName", "fill");
    			attr_dev(animate, "values", "white;" + phase3Col + ";white");
    			attr_dev(animate, "dur", "3s");
    			attr_dev(animate, "repeatCount", "indefinite");
    			add_location(animate, file$4, 115, 12, 2777);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, animate, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(animate);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(115:10) {#if phase == 3}",
    		ctx
    	});

    	return block;
    }

    // (125:8) {#if phase == 4}
    function create_if_block$2(ctx) {
    	let animateTransform;

    	const block = {
    		c: function create() {
    			animateTransform = svg_element("animateTransform");
    			attr_dev(animateTransform, "attributeName", "transform");
    			attr_dev(animateTransform, "attributeType", "XML");
    			attr_dev(animateTransform, "type", "rotate");
    			attr_dev(animateTransform, "from", "360 0 0");
    			attr_dev(animateTransform, "to", "0 0 0");
    			attr_dev(animateTransform, "dur", "0.6s");
    			attr_dev(animateTransform, "repeatCount", "3");
    			add_location(animateTransform, file$4, 125, 10, 3022);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, animateTransform, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(animateTransform);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(125:8) {#if phase == 4}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let svg;
    	let defs;
    	let marker0;
    	let polygon0;
    	let marker1;
    	let polygon1;
    	let marker2;
    	let polygon2;
    	let g2;
    	let path;
    	let g1;
    	let g0;
    	let use0;
    	let use1;
    	let use2;
    	let if_block0 = /*phase*/ ctx[0] > 0 && create_if_block_4(ctx);
    	let if_block1 = /*phase*/ ctx[0] == 1 && create_if_block_3(ctx);
    	let if_block2 = /*phase*/ ctx[0] == 2 && create_if_block_2(ctx);
    	let if_block3 = /*phase*/ ctx[0] == 3 && create_if_block_1(ctx);
    	let if_block4 = /*phase*/ ctx[0] == 4 && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			marker0 = svg_element("marker");
    			polygon0 = svg_element("polygon");
    			marker1 = svg_element("marker");
    			polygon1 = svg_element("polygon");
    			marker2 = svg_element("marker");
    			polygon2 = svg_element("polygon");
    			g2 = svg_element("g");
    			if (if_block0) if_block0.c();
    			path = svg_element("path");
    			g1 = svg_element("g");
    			g0 = svg_element("g");
    			use0 = svg_element("use");
    			if (if_block1) if_block1.c();
    			use1 = svg_element("use");
    			if (if_block2) if_block2.c();
    			use2 = svg_element("use");
    			if (if_block3) if_block3.c();
    			if (if_block4) if_block4.c();
    			attr_dev(polygon0, "points", "0 0, 1.5 1, 0 2");
    			attr_dev(polygon0, "fill", "tomato");
    			add_location(polygon0, file$4, 30, 6, 757);
    			attr_dev(marker0, "id", "arrowheadred");
    			attr_dev(marker0, "markerWidth", "1.5");
    			attr_dev(marker0, "markerHeight", "2");
    			attr_dev(marker0, "refX", "0.5");
    			attr_dev(marker0, "refY", "1");
    			attr_dev(marker0, "orient", "auto");
    			add_location(marker0, file$4, 22, 4, 606);
    			attr_dev(polygon1, "points", "0 0, 1.5 1, 0 2");
    			attr_dev(polygon1, "fill", "olivedrab");
    			add_location(polygon1, file$4, 40, 6, 981);
    			attr_dev(marker1, "id", "arrowheadgreen");
    			attr_dev(marker1, "markerWidth", "1.5");
    			attr_dev(marker1, "markerHeight", "2");
    			attr_dev(marker1, "refX", "0.5");
    			attr_dev(marker1, "refY", "1");
    			attr_dev(marker1, "orient", "auto");
    			add_location(marker1, file$4, 32, 4, 828);
    			attr_dev(polygon2, "points", "0 0, 1.5 1, 0 2");
    			attr_dev(polygon2, "fill", "dodgerblue");
    			add_location(polygon2, file$4, 50, 6, 1207);
    			attr_dev(marker2, "id", "arrowheadblue");
    			attr_dev(marker2, "markerWidth", "1.5");
    			attr_dev(marker2, "markerHeight", "2");
    			attr_dev(marker2, "refX", "0.5");
    			attr_dev(marker2, "refY", "1");
    			attr_dev(marker2, "orient", "auto");
    			add_location(marker2, file$4, 42, 4, 1055);
    			add_location(defs, file$4, 21, 2, 594);
    			attr_dev(path, "id", "arrow");
    			attr_dev(path, "d", "M 0 -0.75\r\n\t\t\t\t\t\tl 0 -0.5\r\n\t\t\t\tA 1.25 1.25, 0, 0, 0, -1.2 -0.21\r\n\t\t\t\t\t\tl -0.25 0, 0.45 0.7 0.45 -0.7 -0.2 0\r\n\t\t\t\t\t\tA 0.75 0.75, 0, 0, 1, 0 -0.75\r\n\t\t\t\t\t\t");
    			attr_dev(path, "stroke-width", "0.02");
    			add_location(path, file$4, 64, 4, 1533);
    			attr_dev(use0, "href", "#arrow");
    			attr_dev(use0, "fill", /*phase1FillCol*/ ctx[3]);
    			attr_dev(use0, "stroke", phase1Col);
    			add_location(use0, file$4, 81, 8, 1883);
    			attr_dev(use1, "href", "#arrow");
    			attr_dev(use1, "fill", /*phase2FillCol*/ ctx[4]);
    			attr_dev(use1, "stroke", phase2Col);
    			attr_dev(use1, "transform", "rotate(-120)");
    			add_location(use1, file$4, 92, 8, 2201);
    			attr_dev(use2, "href", "#arrow");
    			attr_dev(use2, "stroke", phase3Col);
    			attr_dev(use2, "fill", /*phase3FillCol*/ ctx[5]);
    			attr_dev(use2, "transform", "rotate(120)");
    			add_location(use2, file$4, 108, 8, 2598);
    			add_location(g0, file$4, 80, 6, 1870);
    			attr_dev(g1, "transform", "\r\n\t\t\ttranslate(" + /*hsize*/ ctx[6] + " " + /*hsize*/ ctx[6] + ")\r\n            scale(" + /*radius*/ ctx[7] + " " + -/*radius*/ ctx[7] + ")");
    			add_location(g1, file$4, 75, 4, 1763);
    			add_location(g2, file$4, 54, 2, 1293);
    			attr_dev(svg, "height", /*size*/ ctx[2]);
    			attr_dev(svg, "width", /*size*/ ctx[2]);
    			add_location(svg, file$4, 20, 0, 558);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, defs);
    			append_dev(defs, marker0);
    			append_dev(marker0, polygon0);
    			append_dev(defs, marker1);
    			append_dev(marker1, polygon1);
    			append_dev(defs, marker2);
    			append_dev(marker2, polygon2);
    			append_dev(svg, g2);
    			if (if_block0) if_block0.m(g2, null);
    			append_dev(g2, path);
    			append_dev(g2, g1);
    			append_dev(g1, g0);
    			append_dev(g0, use0);
    			if (if_block1) if_block1.m(use0, null);
    			append_dev(g0, use1);
    			if (if_block2) if_block2.m(use1, null);
    			append_dev(g0, use2);
    			if (if_block3) if_block3.m(use2, null);
    			if (if_block4) if_block4.m(g0, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*phase*/ ctx[0] > 0) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(g2, path);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*phase*/ ctx[0] == 1) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(use0, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*phase1FillCol*/ 8) {
    				attr_dev(use0, "fill", /*phase1FillCol*/ ctx[3]);
    			}

    			if (/*phase*/ ctx[0] == 2) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_2(ctx);
    					if_block2.c();
    					if_block2.m(use1, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty & /*phase2FillCol*/ 16) {
    				attr_dev(use1, "fill", /*phase2FillCol*/ ctx[4]);
    			}

    			if (/*phase*/ ctx[0] == 3) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_1(ctx);
    					if_block3.c();
    					if_block3.m(use2, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty & /*phase3FillCol*/ 32) {
    				attr_dev(use2, "fill", /*phase3FillCol*/ ctx[5]);
    			}

    			if (/*phase*/ ctx[0] == 4) {
    				if (if_block4) ; else {
    					if_block4 = create_if_block$2(ctx);
    					if_block4.c();
    					if_block4.m(g0, null);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (dirty & /*size*/ 4) {
    				attr_dev(svg, "height", /*size*/ ctx[2]);
    			}

    			if (dirty & /*size*/ 4) {
    				attr_dev(svg, "width", /*size*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const phase1Col = "tomato";
    const phase2Col = "olivedrab";
    const phase3Col = "dodgerblue";

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TDDCycle', slots, []);
    	let { phase } = $$props;
    	let { text = 1 } = $$props;
    	let { size = 100 } = $$props;
    	let hsize = size / 2;
    	let radius = hsize * 0.65;
    	let textScale = size / 50.0;
    	let phase1FillCol = phase1Col;
    	let phase2FillCol = phase2Col;
    	let phase3FillCol = phase3Col;
    	const writable_props = ['phase', 'text', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TDDCycle> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('phase' in $$props) $$invalidate(0, phase = $$props.phase);
    		if ('text' in $$props) $$invalidate(1, text = $$props.text);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    	};

    	$$self.$capture_state = () => ({
    		phase,
    		text,
    		size,
    		hsize,
    		radius,
    		textScale,
    		phase1Col,
    		phase2Col,
    		phase3Col,
    		phase1FillCol,
    		phase2FillCol,
    		phase3FillCol
    	});

    	$$self.$inject_state = $$props => {
    		if ('phase' in $$props) $$invalidate(0, phase = $$props.phase);
    		if ('text' in $$props) $$invalidate(1, text = $$props.text);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    		if ('hsize' in $$props) $$invalidate(6, hsize = $$props.hsize);
    		if ('radius' in $$props) $$invalidate(7, radius = $$props.radius);
    		if ('textScale' in $$props) $$invalidate(8, textScale = $$props.textScale);
    		if ('phase1FillCol' in $$props) $$invalidate(3, phase1FillCol = $$props.phase1FillCol);
    		if ('phase2FillCol' in $$props) $$invalidate(4, phase2FillCol = $$props.phase2FillCol);
    		if ('phase3FillCol' in $$props) $$invalidate(5, phase3FillCol = $$props.phase3FillCol);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*phase*/ 1) {
    			{
    				$$invalidate(3, phase1FillCol = phase < 2 ? "white" : phase1Col);
    				$$invalidate(4, phase2FillCol = phase < 3 ? "white" : phase2Col);
    				$$invalidate(5, phase3FillCol = phase < 4 ? "white" : phase3Col);
    			}
    		}
    	};

    	return [
    		phase,
    		text,
    		size,
    		phase1FillCol,
    		phase2FillCol,
    		phase3FillCol,
    		hsize,
    		radius,
    		textScale
    	];
    }

    class TDDCycle extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { phase: 0, text: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TDDCycle",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*phase*/ ctx[0] === undefined && !('phase' in props)) {
    			console.warn("<TDDCycle> was created without expected prop 'phase'");
    		}
    	}

    	get phase() {
    		throw new Error("<TDDCycle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set phase(value) {
    		throw new Error("<TDDCycle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get text() {
    		throw new Error("<TDDCycle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set text(value) {
    		throw new Error("<TDDCycle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<TDDCycle>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<TDDCycle>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Iteration.svelte generated by Svelte v3.46.2 */
    const file$3 = "src\\components\\Iteration.svelte";

    function create_fragment$3(ctx) {
    	let div1;
    	let div0;
    	let t0;
    	let tddcycle;
    	let t1;
    	let p;

    	let t2_value = (/*dimmed*/ ctx[2]
    	? ""
    	: "Iteration: " + /*iterationCounter*/ ctx[0]) + "";

    	let t2;
    	let current;

    	tddcycle = new TDDCycle({
    			props: {
    				size: 100,
    				phase: /*phase*/ ctx[1],
    				text: /*iterationCounter*/ ctx[0]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			create_component(tddcycle.$$.fragment);
    			t1 = space();
    			p = element("p");
    			t2 = text(t2_value);
    			attr_dev(div0, "class", "overlay svelte-1chg7m3");
    			add_location(div0, file$3, 9, 2, 233);
    			attr_dev(p, "class", "title");
    			add_location(p, file$3, 11, 2, 319);
    			attr_dev(div1, "class", "iteration svelte-1chg7m3");
    			toggle_class(div1, "dimmed", /*dimmed*/ ctx[2]);
    			add_location(div1, file$3, 8, 0, 193);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div1, t0);
    			mount_component(tddcycle, div1, null);
    			append_dev(div1, t1);
    			append_dev(div1, p);
    			append_dev(p, t2);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const tddcycle_changes = {};
    			if (dirty & /*phase*/ 2) tddcycle_changes.phase = /*phase*/ ctx[1];
    			if (dirty & /*iterationCounter*/ 1) tddcycle_changes.text = /*iterationCounter*/ ctx[0];
    			tddcycle.$set(tddcycle_changes);

    			if ((!current || dirty & /*dimmed, iterationCounter*/ 5) && t2_value !== (t2_value = (/*dimmed*/ ctx[2]
    			? ""
    			: "Iteration: " + /*iterationCounter*/ ctx[0]) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*dimmed*/ 4) {
    				toggle_class(div1, "dimmed", /*dimmed*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tddcycle.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tddcycle.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(tddcycle);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Iteration', slots, []);
    	let { iterationCounter = 0 } = $$props;
    	let { phase = 0 } = $$props;
    	let dimmed = false;
    	const writable_props = ['iterationCounter', 'phase'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Iteration> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('iterationCounter' in $$props) $$invalidate(0, iterationCounter = $$props.iterationCounter);
    		if ('phase' in $$props) $$invalidate(1, phase = $$props.phase);
    	};

    	$$self.$capture_state = () => ({
    		TDDCycle,
    		iterationCounter,
    		phase,
    		dimmed
    	});

    	$$self.$inject_state = $$props => {
    		if ('iterationCounter' in $$props) $$invalidate(0, iterationCounter = $$props.iterationCounter);
    		if ('phase' in $$props) $$invalidate(1, phase = $$props.phase);
    		if ('dimmed' in $$props) $$invalidate(2, dimmed = $$props.dimmed);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*phase*/ 2) {
    			$$invalidate(2, dimmed = phase == 0 || phase == 4);
    		}
    	};

    	return [iterationCounter, phase, dimmed];
    }

    class Iteration extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { iterationCounter: 0, phase: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Iteration",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get iterationCounter() {
    		throw new Error("<Iteration>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set iterationCounter(value) {
    		throw new Error("<Iteration>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get phase() {
    		throw new Error("<Iteration>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set phase(value) {
    		throw new Error("<Iteration>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Game.svelte generated by Svelte v3.46.2 */
    const file$2 = "src\\components\\Game.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (17:2) {#each gameState.iterations as i}
    function create_each_block(ctx) {
    	let iteration;
    	let current;

    	iteration = new Iteration({
    			props: {
    				iterationCounter: /*i*/ ctx[4].index,
    				phase: /*i*/ ctx[4].phase
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(iteration.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(iteration, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const iteration_changes = {};
    			if (dirty & /*gameState*/ 1) iteration_changes.iterationCounter = /*i*/ ctx[4].index;
    			if (dirty & /*gameState*/ 1) iteration_changes.phase = /*i*/ ctx[4].phase;
    			iteration.$set(iteration_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(iteration.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(iteration.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(iteration, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(17:2) {#each gameState.iterations as i}",
    		ctx
    	});

    	return block;
    }

    // (22:2) {#if gameState.getStep()}
    function create_if_block$1(ctx) {
    	let div;
    	let step_1;
    	let div_transition;
    	let current;

    	step_1 = new Step({
    			props: { step: /*gameState*/ ctx[0].getStep() },
    			$$inline: true
    		});

    	step_1.$on("interact", /*nextStep*/ ctx[1]);

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(step_1.$$.fragment);
    			add_location(div, file$2, 22, 4, 486);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(step_1, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const step_1_changes = {};
    			if (dirty & /*gameState*/ 1) step_1_changes.step = /*gameState*/ ctx[0].getStep();
    			step_1.$set(step_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(step_1.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(step_1.$$.fragment, local);
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(step_1);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(22:2) {#if gameState.getStep()}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div0;
    	let t;
    	let div1;
    	let show_if = /*gameState*/ ctx[0].getStep();
    	let current;
    	let each_value = /*gameState*/ ctx[0].iterations;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let if_block = show_if && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			div1 = element("div");
    			if (if_block) if_block.c();
    			attr_dev(div0, "class", "iterations svelte-ej72gv");
    			add_location(div0, file$2, 15, 0, 302);
    			add_location(div1, file$2, 20, 0, 446);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			insert_dev(target, t, anchor);
    			insert_dev(target, div1, anchor);
    			if (if_block) if_block.m(div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*gameState*/ 1) {
    				each_value = /*gameState*/ ctx[0].iterations;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div0, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (dirty & /*gameState*/ 1) show_if = /*gameState*/ ctx[0].getStep();

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*gameState*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Game', slots, []);
    	let { gameState } = $$props;
    	let iterations;
    	let step;

    	const nextStep = () => {
    		gameState.nextStep();
    		$$invalidate(0, gameState);
    	};

    	const writable_props = ['gameState'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Game> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('gameState' in $$props) $$invalidate(0, gameState = $$props.gameState);
    	};

    	$$self.$capture_state = () => ({
    		Step,
    		Iteration,
    		fade,
    		gameState,
    		iterations,
    		step,
    		nextStep
    	});

    	$$self.$inject_state = $$props => {
    		if ('gameState' in $$props) $$invalidate(0, gameState = $$props.gameState);
    		if ('iterations' in $$props) iterations = $$props.iterations;
    		if ('step' in $$props) step = $$props.step;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [gameState, nextStep];
    }

    class Game extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { gameState: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Game",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*gameState*/ ctx[0] === undefined && !('gameState' in props)) {
    			console.warn("<Game> was created without expected prop 'gameState'");
    		}
    	}

    	get gameState() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set gameState(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\IconButton.svelte generated by Svelte v3.46.2 */

    const { console: console_1 } = globals;
    const file$1 = "src\\components\\IconButton.svelte";

    function create_fragment$1(ctx) {
    	let button;
    	let icon_1;
    	let current;
    	let mounted;
    	let dispose;

    	icon_1 = new Icon({
    			props: { icon: /*icon*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			button = element("button");
    			create_component(icon_1.$$.fragment);
    			attr_dev(button, "class", "svelte-tz3mr2");
    			add_location(button, file$1, 8, 0, 152);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			mount_component(icon_1, button, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*onclick*/ ctx[1])) /*onclick*/ ctx[1].apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			const icon_1_changes = {};
    			if (dirty & /*icon*/ 1) icon_1_changes.icon = /*icon*/ ctx[0];
    			icon_1.$set(icon_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(icon_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(icon_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			destroy_component(icon_1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('IconButton', slots, []);
    	let { icon = "" } = $$props;

    	let { onclick = () => {
    		console.log("clicked");
    	} } = $$props;

    	const writable_props = ['icon', 'onclick'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<IconButton> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('icon' in $$props) $$invalidate(0, icon = $$props.icon);
    		if ('onclick' in $$props) $$invalidate(1, onclick = $$props.onclick);
    	};

    	$$self.$capture_state = () => ({ Icon, icon, onclick });

    	$$self.$inject_state = $$props => {
    		if ('icon' in $$props) $$invalidate(0, icon = $$props.icon);
    		if ('onclick' in $$props) $$invalidate(1, onclick = $$props.onclick);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [icon, onclick];
    }

    class IconButton extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { icon: 0, onclick: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IconButton",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get icon() {
    		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set icon(value) {
    		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get onclick() {
    		throw new Error("<IconButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set onclick(value) {
    		throw new Error("<IconButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const states = [
      {
        id: "red",
        title: "Make it Red",
        helpName: "test",
        class: "red",
        next: 1,
        description: "Write the simplest test you can think of that will fail",
        buttonText: "Done: There is ONE failing (red) test",
      },
      {
        id: "swap",
        title: "Swap",
        helpName: "swap",
        class: "swap",
        next: 2,
        description: "Swap the roles of driver and navigator",
        buttonText: "",
      },
      {
        id: "green",
        title: "Make it Green",
        helpName: "code",
        class: "green",
        next: 3,
        description: "Write just enough code to make the failing test pass",
        buttonText: "Done: All the test are now passing (green)",
      },
      {
        id: "refactor",
        title: "Make it Clean",
        helpName: "refactor",
        class: "refactor",
        next: 0,
        description: "Clean up the code you've just written",
        buttonText: "Done: The code is better and all tests are still passing!",
      },
    ];

    const TDDPhase = {
      COMPLETED: 4,
      GREEN: 2,
      REFACTOR: 3,
      RED: 1,
    };

    class GameState {
      constructor(recoveredSavedGame) {
        if (recoveredSavedGame) {
          const r = recoveredSavedGame;
          this.players = r.players;
          this.driver = r.driver;
          this.navigator = r.navigator;
          this.state = r.state;
          this.stepNumber = r.stepNumber;
          this.iteration = r.iteration;
          this.started = r.started;
          this.iterations = r.iterations;
        } else {
          (this.players = ["John", "Jane"]),
            (this.driver = 0),
            (this.navigator = 1),
            (this.state = states[0]),
            (this.stepNumber = 1),
            (this.iteration = 0),
            (this.started = false);
          this.iterations = [];
        }
        this.#save();
      }

      #swapPairRoles = () => {
        this.driver++;
        this.navigator++;
        this.driver %= 2;
        this.navigator %= 2;
      };

      #get4Iterations = (idx) => {
        return [
          { phase: 1, index: idx++ },
          { phase: 0, index: idx++ },
          { phase: 0, index: idx++ },
          { phase: 0, index: idx++ },
        ];
      };

      static GAME_STATE = "GAME_STATE";

      #save = () => {
        localStorage.setItem(GameState.GAME_STATE, JSON.stringify(this));
      };

      static recoverSavedGame = () => {
        var ls = localStorage.getItem(GameState.GAME_STATE);
        return ls ? new GameState(JSON.parse(ls)) : null;
      };

      start() {
        this.started = true;
        this.iterations = this.#get4Iterations(1);
        this.#save();
      }

      nextStep() {
        if (!this.state) {
          console.log("Error: next step called but no state");
        }
        this.state = states[this.state.next];
        this.stepNumber++;

        if (this.state.id == "red") {
          this.iterations[this.iteration].phase = TDDPhase.COMPLETED;
          this.iteration++;

          if (this.iteration >= this.iterations.length) {
            const its = this.#get4Iterations(this.iterations.length + 1);
            this.iterations = [...this.iterations, ...its];
          }

          this.iterations[this.iteration].phase = TDDPhase.RED;
        }

        if (this.state.id == "green") {
          this.iterations[this.iteration].phase = TDDPhase.GREEN;
        }
        if (this.state.id == "refactor") {
          this.iterations[this.iteration].phase = TDDPhase.REFACTOR;
        }
        if (this.state.id == "swap") {
          this.iterations[this.iteration].phase = TDDPhase.GREEN;
          this.#swapPairRoles();
        }
        this.#save();
      }

      #driver = () => this.players[this.driver];
      #navigator = () => this.players[this.navigator];

      getStep = () => {
        const step = {
          title: "Step:" + this.stepNumber + " " + this.state.title,
          bodyText: this.state.description,
          buttonText: this.state.buttonText,
          classes: "" + this.state.class + " step",
          helpName: this.state.helpName,
          driver: this.#driver(),
          navigator: this.#navigator(),
          iteration: this.iteration,
          stateName: this.state.id,
        };

        if (this.state.id == "swap") {
          step.title = "Swap pair programming roles";
          step.bodyText =
            this.#driver() +
            " is now the driver and " +
            this.#navigator() +
            " is the navigator";

          step.buttonText = "OK:" + this.#driver() + " has the keyboard";
          step.classes = "" + this.state.class + " swap step"; //TODO is this redundant?
          step.helpName = "swap"; //TODO is this redundant?
        }
        return step;
      };
    }

    // export const resetGame = () => {
    //     const gs = copyOfInitialGameState();
    //     _gameState.set(gs);
    //     localStorage.setItem(GAME_STATE, JSON.stringify(gs))
    // }
    // const GAME_STATE = "GAME_STATE";
    // const copyOfInitialGameState = () => JSON.parse(JSON.stringify(initialGameState));

    // export const _gameState = writable(
    //     localStorage[GAME_STATE]
    //         ? JSON.parse(localStorage[GAME_STATE])
    //         : copyOfInitialGameState());

    /* src\App.svelte generated by Svelte v3.46.2 */
    const file = "src\\App.svelte";

    // (62:4) {:else}
    function create_else_block(ctx) {
    	let p0;
    	let t1;
    	let ol;
    	let li0;
    	let p1;
    	let t2;
    	let strong;
    	let t4;
    	let em;
    	let t6;
    	let t7;
    	let p2;
    	let t9;
    	let li1;
    	let t11;
    	let li2;
    	let t13;
    	let div;
    	let span0;
    	let label0;
    	let t15;
    	let input0;
    	let br0;
    	let t16;
    	let span1;
    	let label1;
    	let t18;
    	let input1;
    	let br1;
    	let t19;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			p0.textContent = "Test Driven Development (TDD) is a process for writing code that involves\r\n      repeatedly appying three distinct steps:";
    			t1 = space();
    			ol = element("ol");
    			li0 = element("li");
    			p1 = element("p");
    			t2 = text("Describe one very simple thing what your code ");
    			strong = element("strong");
    			strong.textContent = "should";
    			t4 = text("\r\n          do. We write this description in a ");
    			em = element("em");
    			em.textContent = "\"test\"";
    			t6 = text(". A test is a special\r\n          function that can check if a single peice of code does what you say it\r\n          should do.");
    			t7 = space();
    			p2 = element("p");
    			p2.textContent = "After you write the test, the test will fail, but that is OK as you\r\n          won't have written the code yet.";
    			t9 = space();
    			li1 = element("li");
    			li1.textContent = "The next step is to to write enough code that will make the test pass.\r\n          You don't have to write very much, nor do you have to write clever code.\r\n          You can even hard code in results that will pass the test. The code written at this stage will usually\r\n          be low quality, and specifit to the test. But that is ok, we will get a chance to improve the code later on. \r\n          During this step the important thing is to get the test passing.";
    			t11 = space();
    			li2 = element("li");
    			li2.textContent = "Once the test is passing (green), the final step in the cycle is refactoring. This is where we look at the code\r\n          we just wrote and try to find patterns that we can use to make the code more general. \r\n          We will repeat these three steps with tests covering more and more of the required behaviour.";
    			t13 = space();
    			div = element("div");
    			span0 = element("span");
    			label0 = element("label");
    			label0.textContent = "Player 1";
    			t15 = space();
    			input0 = element("input");
    			br0 = element("br");
    			t16 = space();
    			span1 = element("span");
    			label1 = element("label");
    			label1.textContent = "Player 2";
    			t18 = space();
    			input1 = element("input");
    			br1 = element("br");
    			t19 = space();
    			button = element("button");
    			button.textContent = "Start Game";
    			add_location(p0, file, 62, 6, 1909);
    			add_location(strong, file, 69, 56, 2144);
    			add_location(em, file, 70, 45, 2214);
    			add_location(p1, file, 68, 8, 2083);
    			add_location(p2, file, 74, 8, 2378);
    			attr_dev(li0, "class", "svelte-x21k7e");
    			add_location(li0, file, 67, 6, 2069);
    			attr_dev(li1, "class", "svelte-x21k7e");
    			add_location(li1, file, 79, 6, 2539);
    			attr_dev(li2, "class", "svelte-x21k7e");
    			add_location(li2, file, 85, 6, 3029);
    			add_location(ol, file, 66, 4, 2057);
    			attr_dev(label0, "for", "fname");
    			attr_dev(label0, "class", "svelte-x21k7e");
    			add_location(label0, file, 92, 10, 3412);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "fname");
    			attr_dev(input0, "name", "fname");
    			add_location(input0, file, 93, 10, 3459);
    			add_location(br0, file, 98, 12, 3601);
    			add_location(span0, file, 91, 8, 3394);
    			attr_dev(label1, "for", "lname");
    			attr_dev(label1, "class", "svelte-x21k7e");
    			add_location(label1, file, 101, 10, 3652);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "lname");
    			attr_dev(input1, "name", "lname");
    			add_location(input1, file, 102, 10, 3699);
    			add_location(br1, file, 107, 12, 3841);
    			add_location(span1, file, 100, 8, 3634);
    			attr_dev(button, "id", "startBtn");
    			add_location(button, file, 109, 8, 3874);
    			add_location(div, file, 90, 6, 3379);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, ol, anchor);
    			append_dev(ol, li0);
    			append_dev(li0, p1);
    			append_dev(p1, t2);
    			append_dev(p1, strong);
    			append_dev(p1, t4);
    			append_dev(p1, em);
    			append_dev(p1, t6);
    			append_dev(li0, t7);
    			append_dev(li0, p2);
    			append_dev(ol, t9);
    			append_dev(ol, li1);
    			append_dev(ol, t11);
    			append_dev(ol, li2);
    			insert_dev(target, t13, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, span0);
    			append_dev(span0, label0);
    			append_dev(span0, t15);
    			append_dev(span0, input0);
    			set_input_value(input0, /*gameState*/ ctx[0].players[0]);
    			append_dev(span0, br0);
    			append_dev(div, t16);
    			append_dev(div, span1);
    			append_dev(span1, label1);
    			append_dev(span1, t18);
    			append_dev(span1, input1);
    			set_input_value(input1, /*gameState*/ ctx[0].players[1]);
    			append_dev(span1, br1);
    			append_dev(div, t19);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[3]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[4]),
    					listen_dev(button, "click", /*startGame*/ ctx[1], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*gameState*/ 1 && input0.value !== /*gameState*/ ctx[0].players[0]) {
    				set_input_value(input0, /*gameState*/ ctx[0].players[0]);
    			}

    			if (dirty & /*gameState*/ 1 && input1.value !== /*gameState*/ ctx[0].players[1]) {
    				set_input_value(input1, /*gameState*/ ctx[0].players[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(ol);
    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(62:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (58:4) {#if gameState.started}
    function create_if_block(ctx) {
    	let div;
    	let game;
    	let div_intro;
    	let current;

    	game = new Game({
    			props: { gameState: /*gameState*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(game.$$.fragment);
    			add_location(div, file, 58, 6, 1803);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(game, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const game_changes = {};
    			if (dirty & /*gameState*/ 1) game_changes.gameState = /*gameState*/ ctx[0];
    			game.$set(game_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(game.$$.fragment, local);

    			if (!div_intro) {
    				add_render_callback(() => {
    					div_intro = create_in_transition(div, fly, { y: 200, duration: 2000 });
    					div_intro.start();
    				});
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(game.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(game);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(58:4) {#if gameState.started}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let link0;
    	let link1;
    	let link2;
    	let t0;
    	let title;
    	let t2;
    	let main;
    	let header;
    	let div0;
    	let iconbutton;
    	let t3;
    	let div1;
    	let svg;
    	let filter;
    	let feGaussianBlur;
    	let feOffset;
    	let feMorphology;
    	let t4;
    	let span0;
    	let t6;
    	let span1;
    	let t8;
    	let span2;
    	let span3;
    	let t11;
    	let div2;
    	let t13;
    	let h2;
    	let t15;
    	let section;
    	let current_block_type_index;
    	let if_block;
    	let current;

    	iconbutton = new IconButton({
    			props: {
    				onclick: /*reStartGame*/ ctx[2],
    				icon: "restart"
    			},
    			$$inline: true
    		});

    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*gameState*/ ctx[0].started) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			link0 = element("link");
    			link1 = element("link");
    			link2 = element("link");
    			t0 = space();
    			title = element("title");
    			title.textContent = "Red Green Go!";
    			t2 = space();
    			main = element("main");
    			header = element("header");
    			div0 = element("div");
    			create_component(iconbutton.$$.fragment);
    			t3 = space();
    			div1 = element("div");
    			svg = svg_element("svg");
    			filter = svg_element("filter");
    			feGaussianBlur = svg_element("feGaussianBlur");
    			feOffset = svg_element("feOffset");
    			feMorphology = svg_element("feMorphology");
    			t4 = space();
    			span0 = element("span");
    			span0.textContent = "Red";
    			t6 = text("-");
    			span1 = element("span");
    			span1.textContent = "Green";
    			t8 = text("-");
    			span2 = element("span");
    			span2.textContent = "G";
    			span3 = element("span");
    			span3.textContent = "o!";
    			t11 = space();
    			div2 = element("div");
    			div2.textContent = "x";
    			t13 = space();
    			h2 = element("h2");
    			h2.textContent = "A game of TDD & Pairing";
    			t15 = space();
    			section = element("section");
    			if_block.c();
    			attr_dev(link0, "rel", "preconnect");
    			attr_dev(link0, "href", "https://fonts.googleapis.com");
    			add_location(link0, file, 23, 2, 610);
    			attr_dev(link1, "rel", "preconnect");
    			attr_dev(link1, "href", "https://fonts.gstatic.com");
    			attr_dev(link1, "crossorigin", "");
    			add_location(link1, file, 24, 2, 675);
    			attr_dev(link2, "href", "https://fonts.googleapis.com/css2?family=Bangers&family=Montserrat:ital,wght@0,300;0,500;1,100;1,300;1,500&family=Roboto+Mono:ital,wght@0,277;0,300;1,300&family=Zilla+Slab:wght@300;400;700&display=swap");
    			attr_dev(link2, "rel", "stylesheet");
    			add_location(link2, file, 25, 2, 749);
    			add_location(title, file, 30, 0, 1014);
    			attr_dev(div0, "class", "menu");
    			add_location(div0, file, 34, 4, 1070);
    			attr_dev(feGaussianBlur, "stdDeviation", "10 0");
    			add_location(feGaussianBlur, file, 40, 10, 1315);
    			attr_dev(feOffset, "dx", "5");
    			add_location(feOffset, file, 41, 10, 1365);
    			attr_dev(feMorphology, "operator", "erode");
    			attr_dev(feMorphology, "radius", "1");
    			add_location(feMorphology, file, 42, 10, 1396);
    			attr_dev(filter, "id", "motion-blur-filter");
    			attr_dev(filter, "filterUnits", "userSpaceOnUse");
    			add_location(filter, file, 39, 8, 1242);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "class", "svelte-x21k7e");
    			add_location(svg, file, 38, 6, 1192);
    			attr_dev(span0, "id", "red");
    			attr_dev(span0, "class", "svelte-x21k7e");
    			add_location(span0, file, 45, 6, 1481);
    			attr_dev(span1, "id", "green");
    			attr_dev(span1, "class", "svelte-x21k7e");
    			add_location(span1, file, 45, 32, 1507);
    			attr_dev(span2, "filter-content", "G");
    			attr_dev(span2, "class", "swoosh svelte-x21k7e");
    			attr_dev(span2, "id", "blue");
    			add_location(span2, file, 45, 62, 1537);
    			attr_dev(span3, "id", "blue");
    			attr_dev(span3, "class", "svelte-x21k7e");
    			add_location(span3, file, 49, 7, 1630);
    			attr_dev(div1, "class", "title svelte-x21k7e");
    			add_location(div1, file, 37, 4, 1165);
    			attr_dev(div2, "class", "menu");
    			add_location(div2, file, 51, 4, 1673);
    			attr_dev(header, "class", "svelte-x21k7e");
    			add_location(header, file, 33, 2, 1056);
    			attr_dev(h2, "class", "svelte-x21k7e");
    			add_location(h2, file, 54, 2, 1717);
    			add_location(section, file, 56, 2, 1757);
    			attr_dev(main, "class", "svelte-x21k7e");
    			add_location(main, file, 32, 0, 1046);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			append_dev(document.head, link0);
    			append_dev(document.head, link1);
    			append_dev(document.head, link2);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, title, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, header);
    			append_dev(header, div0);
    			mount_component(iconbutton, div0, null);
    			append_dev(header, t3);
    			append_dev(header, div1);
    			append_dev(div1, svg);
    			append_dev(svg, filter);
    			append_dev(filter, feGaussianBlur);
    			append_dev(filter, feOffset);
    			append_dev(filter, feMorphology);
    			append_dev(div1, t4);
    			append_dev(div1, span0);
    			append_dev(div1, t6);
    			append_dev(div1, span1);
    			append_dev(div1, t8);
    			append_dev(div1, span2);
    			append_dev(div1, span3);
    			append_dev(header, t11);
    			append_dev(header, div2);
    			append_dev(main, t13);
    			append_dev(main, h2);
    			append_dev(main, t15);
    			append_dev(main, section);
    			if_blocks[current_block_type_index].m(section, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(section, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(iconbutton.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(iconbutton.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			detach_dev(link0);
    			detach_dev(link1);
    			detach_dev(link2);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(title);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(main);
    			destroy_component(iconbutton);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let gameState = GameState.recoverSavedGame();

    	if (!gameState) {
    		gameState = new GameState();
    	}

    	const startGame = () => {
    		gameState.start();
    		$$invalidate(0, gameState);
    	};

    	const reStartGame = () => {
    		$$invalidate(0, gameState = new GameState());
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		gameState.players[0] = this.value;
    		$$invalidate(0, gameState);
    	}

    	function input1_input_handler() {
    		gameState.players[1] = this.value;
    		$$invalidate(0, gameState);
    	}

    	$$self.$capture_state = () => ({
    		Game,
    		IconButton,
    		GameState,
    		fly,
    		gameState,
    		startGame,
    		reStartGame
    	});

    	$$self.$inject_state = $$props => {
    		if ('gameState' in $$props) $$invalidate(0, gameState = $$props.gameState);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [gameState, startGame, reStartGame, input0_input_handler, input1_input_handler];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
      target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
