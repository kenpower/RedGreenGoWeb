
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
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
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }
    function set_store_value(store, ret, value) {
        store.set(value);
        return ret;
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

    /* src\components\Modal.svelte generated by Svelte v3.46.2 */
    const file$5 = "src\\components\\Modal.svelte";

    function create_fragment$6(ctx) {
    	let div0;
    	let t0;
    	let div5;
    	let div4;
    	let div1;
    	let t1;
    	let t2;
    	let t3;
    	let div2;
    	let t4;
    	let t5;
    	let div3;
    	let div5_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = space();
    			div5 = element("div");
    			div4 = element("div");
    			div1 = element("div");
    			t1 = text(/*typeText*/ ctx[3]);
    			t2 = text("?");
    			t3 = space();
    			div2 = element("div");
    			t4 = text(/*titleText*/ ctx[2]);
    			t5 = space();
    			div3 = element("div");
    			attr_dev(div0, "id", "background");
    			set_style(div0, "display", /*isOpenModal*/ ctx[0] ? 'block' : 'none');
    			attr_dev(div0, "class", "svelte-3jfthi");
    			add_location(div0, file$5, 21, 0, 429);
    			attr_dev(div1, "class", "cardType svelte-3jfthi");
    			add_location(div1, file$5, 31, 12, 709);
    			attr_dev(div2, "class", "title svelte-3jfthi");
    			add_location(div2, file$5, 33, 12, 779);
    			attr_dev(div3, "class", "bodyText svelte-3jfthi");
    			add_location(div3, file$5, 34, 12, 832);
    			attr_dev(div4, "id", "modal");
    			attr_dev(div4, "class", "svelte-3jfthi");
    			add_location(div4, file$5, 30, 8, 679);
    			attr_dev(div5, "id", "frame");
    			attr_dev(div5, "class", div5_class_value = "" + (null_to_empty(/*cardType*/ ctx[4]) + " svelte-3jfthi"));
    			set_style(div5, "display", /*isOpenModal*/ ctx[0] ? 'block' : 'none');
    			add_location(div5, file$5, 28, 0, 580);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div4);
    			append_dev(div4, div1);
    			append_dev(div1, t1);
    			append_dev(div1, t2);
    			append_dev(div4, t3);
    			append_dev(div4, div2);
    			append_dev(div2, t4);
    			append_dev(div4, t5);
    			append_dev(div4, div3);
    			div3.innerHTML = /*bodyText*/ ctx[1];

    			if (!mounted) {
    				dispose = listen_dev(div0, "click", /*closeModal*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*isOpenModal*/ 1) {
    				set_style(div0, "display", /*isOpenModal*/ ctx[0] ? 'block' : 'none');
    			}

    			if (dirty & /*typeText*/ 8) set_data_dev(t1, /*typeText*/ ctx[3]);
    			if (dirty & /*titleText*/ 4) set_data_dev(t4, /*titleText*/ ctx[2]);
    			if (dirty & /*bodyText*/ 2) div3.innerHTML = /*bodyText*/ ctx[1];
    			if (dirty & /*cardType*/ 16 && div5_class_value !== (div5_class_value = "" + (null_to_empty(/*cardType*/ ctx[4]) + " svelte-3jfthi"))) {
    				attr_dev(div5, "class", div5_class_value);
    			}

    			if (dirty & /*isOpenModal*/ 1) {
    				set_style(div5, "display", /*isOpenModal*/ ctx[0] ? 'block' : 'none');
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div5);
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

    function instance$6($$self, $$props, $$invalidate) {
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
    		dispatch('closeModal', { isOpenModal });
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

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
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
    			id: create_fragment$6.name
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

    const { console: console_1$1 } = globals;

    function create_fragment$5(ctx) {
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
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
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
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<HintCard> was created with unknown prop '${key}'`);
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
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { showHint: 6, cardType: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "HintCard",
    			options,
    			id: create_fragment$5.name
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

    /* src\components\Step.svelte generated by Svelte v3.46.2 */
    const file$4 = "src\\components\\Step.svelte";

    // (29:0) {#key step}
    function create_key_block(ctx) {
    	let div1;
    	let p0;
    	let t0_value = /*step*/ ctx[0].title + "";
    	let t0;
    	let t1;
    	let div0;
    	let p1;
    	let t2_value = /*step*/ ctx[0].bodyText + "";
    	let t2;
    	let t3;
    	let button0;
    	let t4_value = /*step*/ ctx[0].buttonText + "";
    	let t4;
    	let t5;
    	let button1;
    	let t7;
    	let hintcard;
    	let div1_class_value;
    	let div1_intro;
    	let div1_outro;
    	let current;
    	let mounted;
    	let dispose;

    	hintcard = new HintCard({
    			props: {
    				showHint: /*showHint*/ ctx[1],
    				cardType: /*step*/ ctx[0].helpName
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			p0 = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			div0 = element("div");
    			p1 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			button0 = element("button");
    			t4 = text(t4_value);
    			t5 = space();
    			button1 = element("button");
    			button1.textContent = "Hint";
    			t7 = space();
    			create_component(hintcard.$$.fragment);
    			attr_dev(p0, "class", "title svelte-bt3w54");
    			add_location(p0, file$4, 30, 4, 625);
    			attr_dev(p1, "class", "svelte-bt3w54");
    			add_location(p1, file$4, 33, 8, 701);
    			attr_dev(button0, "class", "svelte-bt3w54");
    			add_location(button0, file$4, 34, 8, 733);
    			attr_dev(button1, "class", "svelte-bt3w54");
    			add_location(button1, file$4, 35, 8, 806);
    			attr_dev(div0, "class", "stepBody svelte-bt3w54");
    			add_location(div0, file$4, 32, 4, 668);
    			attr_dev(div1, "class", div1_class_value = "" + (null_to_empty(/*step*/ ctx[0].classes) + " svelte-bt3w54"));
    			attr_dev(div1, "id", "theStep");
    			add_location(div1, file$4, 29, 0, 516);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, p0);
    			append_dev(p0, t0);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, p1);
    			append_dev(p1, t2);
    			append_dev(div0, t3);
    			append_dev(div0, button0);
    			append_dev(button0, t4);
    			append_dev(div0, t5);
    			append_dev(div0, button1);
    			append_dev(div1, t7);
    			mount_component(hintcard, div1, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button0,
    						"click",
    						function () {
    							if (is_function(/*step*/ ctx[0].buttonAction)) /*step*/ ctx[0].buttonAction.apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(button1, "click", /*showCard*/ ctx[2], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*step*/ 1) && t0_value !== (t0_value = /*step*/ ctx[0].title + "")) set_data_dev(t0, t0_value);
    			if ((!current || dirty & /*step*/ 1) && t2_value !== (t2_value = /*step*/ ctx[0].bodyText + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty & /*step*/ 1) && t4_value !== (t4_value = /*step*/ ctx[0].buttonText + "")) set_data_dev(t4, t4_value);
    			const hintcard_changes = {};
    			if (dirty & /*showHint*/ 2) hintcard_changes.showHint = /*showHint*/ ctx[1];
    			if (dirty & /*step*/ 1) hintcard_changes.cardType = /*step*/ ctx[0].helpName;
    			hintcard.$set(hintcard_changes);

    			if (!current || dirty & /*step*/ 1 && div1_class_value !== (div1_class_value = "" + (null_to_empty(/*step*/ ctx[0].classes) + " svelte-bt3w54"))) {
    				attr_dev(div1, "class", div1_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(hintcard.$$.fragment, local);

    			add_render_callback(() => {
    				if (div1_outro) div1_outro.end(1);
    				div1_intro = create_in_transition(div1, fly, { delay: 300, y: 400, duration: 1000 });
    				div1_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(hintcard.$$.fragment, local);
    			if (div1_intro) div1_intro.invalidate();
    			div1_outro = create_out_transition(div1, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(hintcard);
    			if (detaching && div1_outro) div1_outro.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_key_block.name,
    		type: "key",
    		source: "(29:0) {#key step}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let previous_key = /*step*/ ctx[0];
    	let key_block_anchor;
    	let current;
    	let key_block = create_key_block(ctx);

    	const block = {
    		c: function create() {
    			key_block.c();
    			key_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			key_block.m(target, anchor);
    			insert_dev(target, key_block_anchor, anchor);
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
    				key_block.m(key_block_anchor.parentNode, key_block_anchor);
    			} else {
    				key_block.p(ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(key_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(key_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(key_block_anchor);
    			key_block.d(detaching);
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

    function scrollIntoView() {
    	const el = document.getElementById("theStep");
    	if (!el) return;
    	el.scrollIntoView({ behavior: 'smooth' });
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Step', slots, []);
    	let { step } = $$props;
    	let showHint = false;

    	async function showCard() {
    		$$invalidate(1, showHint = true);
    		await tick();
    		$$invalidate(1, showHint = false);
    	}

    	const writable_props = ['step'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Step> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('step' in $$props) $$invalidate(0, step = $$props.step);
    	};

    	$$self.$capture_state = () => ({
    		HintCard,
    		fade,
    		fly,
    		blur,
    		scale,
    		tick,
    		step,
    		showHint,
    		showCard,
    		scrollIntoView
    	});

    	$$self.$inject_state = $$props => {
    		if ('step' in $$props) $$invalidate(0, step = $$props.step);
    		if ('showHint' in $$props) $$invalidate(1, showHint = $$props.showHint);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	{
    		scrollIntoView();
    	}

    	return [step, showHint, showCard];
    }

    class Step extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { step: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Step",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*step*/ ctx[0] === undefined && !('step' in props)) {
    			console.warn("<Step> was created without expected prop 'step'");
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

    const file$3 = "src\\components\\TDDCycle.svelte";

    // (38:3) {#if phase > 0}
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
    			add_location(text_1, file$3, 38, 2, 1165);
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
    		source: "(38:3) {#if phase > 0}",
    		ctx
    	});

    	return block;
    }

    // (57:4) {#if phase == 1}
    function create_if_block_3(ctx) {
    	let animate;

    	const block = {
    		c: function create() {
    			animate = svg_element("animate");
    			attr_dev(animate, "attributeName", "fill");
    			attr_dev(animate, "values", "white;" + phase1Col + ";white");
    			attr_dev(animate, "dur", "3s");
    			attr_dev(animate, "repeatCount", "indefinite");
    			add_location(animate, file$3, 57, 5, 1728);
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
    		source: "(57:4) {#if phase == 1}",
    		ctx
    	});

    	return block;
    }

    // (66:3) {#if phase == 2}
    function create_if_block_2(ctx) {
    	let animate;

    	const block = {
    		c: function create() {
    			animate = svg_element("animate");
    			attr_dev(animate, "attributeName", "fill");
    			attr_dev(animate, "values", "white;" + phase2Col + ";white");
    			attr_dev(animate, "dur", "3s");
    			attr_dev(animate, "repeatCount", "indefinite");
    			add_location(animate, file$3, 66, 3, 1989);
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
    		source: "(66:3) {#if phase == 2}",
    		ctx
    	});

    	return block;
    }

    // (73:3) {#if phase == 3}
    function create_if_block_1(ctx) {
    	let animate;

    	const block = {
    		c: function create() {
    			animate = svg_element("animate");
    			attr_dev(animate, "attributeName", "fill");
    			attr_dev(animate, "values", "white;" + phase3Col + ";white");
    			attr_dev(animate, "dur", "3s");
    			attr_dev(animate, "repeatCount", "indefinite");
    			add_location(animate, file$3, 73, 3, 2234);
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
    		source: "(73:3) {#if phase == 3}",
    		ctx
    	});

    	return block;
    }

    // (78:3) {#if phase == 4}
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
    			add_location(animateTransform, file$3, 78, 4, 2383);
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
    		source: "(78:3) {#if phase == 4}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
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
    			add_location(polygon0, file$3, 24, 6, 677);
    			attr_dev(marker0, "id", "arrowheadred");
    			attr_dev(marker0, "markerWidth", "1.5");
    			attr_dev(marker0, "markerHeight", "2");
    			attr_dev(marker0, "refX", "0.5");
    			attr_dev(marker0, "refY", "1");
    			attr_dev(marker0, "orient", "auto");
    			add_location(marker0, file$3, 22, 4, 568);
    			attr_dev(polygon1, "points", "0 0, 1.5 1, 0 2");
    			attr_dev(polygon1, "fill", "olivedrab");
    			add_location(polygon1, file$3, 28, 6, 864);
    			attr_dev(marker1, "id", "arrowheadgreen");
    			attr_dev(marker1, "markerWidth", "1.5");
    			attr_dev(marker1, "markerHeight", "2");
    			attr_dev(marker1, "refX", "0.5");
    			attr_dev(marker1, "refY", "1");
    			attr_dev(marker1, "orient", "auto");
    			add_location(marker1, file$3, 26, 7, 753);
    			attr_dev(polygon2, "points", "0 0, 1.5 1, 0 2");
    			attr_dev(polygon2, "fill", "dodgerblue");
    			add_location(polygon2, file$3, 32, 6, 1051);
    			attr_dev(marker2, "id", "arrowheadblue");
    			attr_dev(marker2, "markerWidth", "1.5");
    			attr_dev(marker2, "markerHeight", "2");
    			attr_dev(marker2, "refX", "0.5");
    			attr_dev(marker2, "refY", "1");
    			attr_dev(marker2, "orient", "auto");
    			add_location(marker2, file$3, 30, 7, 941);
    			add_location(defs, file$3, 21, 3, 556);
    			attr_dev(path, "id", "arrow");
    			attr_dev(path, "d", "M 0 -0.75\r\n\t\t\t\t\t\tl 0 -0.5\r\n\t\t\t\tA 1.25 1.25, 0, 0, 0, -1.2 -0.21\r\n\t\t\t\t\t\tl -0.25 0, 0.45 0.7 0.45 -0.7 -0.2 0\r\n\t\t\t\t\t\tA 0.75 0.75, 0, 0, 1, 0 -0.75\r\n\t\t\t\t\t\t");
    			attr_dev(path, "stroke-width", "0.02");
    			add_location(path, file$3, 40, 2, 1314);
    			attr_dev(use0, "href", "#arrow");
    			attr_dev(use0, "fill", /*phase1FillCol*/ ctx[3]);
    			attr_dev(use0, "stroke", phase1Col);
    			add_location(use0, file$3, 53, 3, 1625);
    			attr_dev(use1, "href", "#arrow");
    			attr_dev(use1, "fill", /*phase2FillCol*/ ctx[4]);
    			attr_dev(use1, "stroke", phase2Col);
    			attr_dev(use1, "transform", "rotate(-120)");
    			add_location(use1, file$3, 61, 3, 1859);
    			attr_dev(use2, "href", "#arrow");
    			attr_dev(use2, "stroke", phase3Col);
    			attr_dev(use2, "fill", /*phase3FillCol*/ ctx[5]);
    			attr_dev(use2, "transform", "rotate(120)");
    			add_location(use2, file$3, 71, 3, 2122);
    			add_location(g0, file$3, 52, 3, 1617);
    			attr_dev(g1, "transform", "\r\n\t\t\ttranslate(" + /*hsize*/ ctx[6] + " " + /*hsize*/ ctx[6] + ")\r\n            scale(" + /*radius*/ ctx[7] + " " + -/*radius*/ ctx[7] + ")");
    			add_location(g1, file$3, 49, 2, 1525);
    			add_location(g2, file$3, 36, 2, 1137);
    			attr_dev(svg, "height", /*size*/ ctx[2]);
    			attr_dev(svg, "width", /*size*/ ctx[2]);
    			add_location(svg, file$3, 20, 0, 515);
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
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const phase1Col = "tomato";
    const phase2Col = "olivedrab";
    const phase3Col = "dodgerblue";

    function instance$3($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { phase: 0, text: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TDDCycle",
    			options,
    			id: create_fragment$3.name
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
    const file$2 = "src\\components\\Iteration.svelte";

    function create_fragment$2(ctx) {
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
    			attr_dev(div0, "class", "overlay svelte-1q3e0gx");
    			add_location(div0, file$2, 9, 4, 238);
    			attr_dev(p, "class", "title");
    			add_location(p, file$2, 11, 4, 344);
    			attr_dev(div1, "class", "iteration svelte-1q3e0gx");
    			toggle_class(div1, "dimmed", /*dimmed*/ ctx[2]);
    			add_location(div1, file$2, 8, 0, 196);
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
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { iterationCounter: 0, phase: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Iteration",
    			options,
    			id: create_fragment$2.name
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

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const initialGameState = {
        players : ["John", "Jane"],
        curDriver: 0,
        curNavigator: 1,
        curState : undefined,
        stepNumber : 1, 
        iterationCounter : 0,    
        curIteration: undefined,
        step :  undefined,
        steps : [],
        iterations : []

    };

    const gameState = writable(initialGameState);

    /* src\components\Game.svelte generated by Svelte v3.46.2 */

    const { Object: Object_1, console: console_1 } = globals;
    const file$1 = "src\\components\\Game.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (128:0) {#each $gameState.iterations as i}
    function create_each_block(ctx) {
    	let iteration;
    	let current;

    	iteration = new Iteration({
    			props: {
    				iterationCounter: /*i*/ ctx[9].index,
    				phase: /*i*/ ctx[9].phase
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
    			if (dirty & /*$gameState*/ 1) iteration_changes.iterationCounter = /*i*/ ctx[9].index;
    			if (dirty & /*$gameState*/ 1) iteration_changes.phase = /*i*/ ctx[9].phase;
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
    		source: "(128:0) {#each $gameState.iterations as i}",
    		ctx
    	});

    	return block;
    }

    // (133:0) {#if $gameState.step}
    function create_if_block$1(ctx) {
    	let div;
    	let step;
    	let div_transition;
    	let current;

    	step = new Step({
    			props: { step: /*$gameState*/ ctx[0].step },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(step.$$.fragment);
    			add_location(div, file$1, 133, 0, 4495);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(step, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const step_changes = {};
    			if (dirty & /*$gameState*/ 1) step_changes.step = /*$gameState*/ ctx[0].step;
    			step.$set(step_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(step.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(step.$$.fragment, local);
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fade, {}, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(step);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(133:0) {#if $gameState.step}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div0;
    	let t;
    	let div1;
    	let current;
    	let each_value = /*$gameState*/ ctx[0].iterations;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let if_block = /*$gameState*/ ctx[0].step && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			div1 = element("div");
    			if (if_block) if_block.c();
    			attr_dev(div0, "class", "iterations svelte-14wazpl");
    			add_location(div0, file$1, 126, 0, 4321);
    			add_location(div1, file$1, 131, 0, 4465);
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
    			if (dirty & /*$gameState*/ 1) {
    				each_value = /*$gameState*/ ctx[0].iterations;
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

    			if (/*$gameState*/ ctx[0].step) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$gameState*/ 1) {
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
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $gameState;
    	validate_store(gameState, 'gameState');
    	component_subscribe($$self, gameState, $$value => $$invalidate(0, $gameState = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Game', slots, []);

    	var states = [
    		{
    			id: "red",
    			title: "Make it Red",
    			helpName: "test",
    			class: "red",
    			next: 1,
    			description: "Write the simplest test you can think of that will fail",
    			buttonText: "Done: There is ONE failing (red) test"
    		},
    		{
    			id: "swap",
    			title: "Swap",
    			helpName: "swap",
    			class: "swap",
    			next: 2,
    			description: "Swap the roles of driver and navigator",
    			buttonText: ""
    		},
    		{
    			id: "green",
    			title: "Make it Green",
    			helpName: "code",
    			class: "green",
    			next: 3,
    			description: "Write just enough code to make the failing test pass",
    			buttonText: "Done: All the test are now passing (green)"
    		},
    		{
    			id: "refactor",
    			title: "Make it Clean",
    			helpName: "refactor",
    			class: "refactor",
    			next: 0,
    			description: "Clean up the code you've just written",
    			buttonText: "Done: The code is better and all tests are still passing!"
    		}
    	];

    	let { players = ["John", "Jane"] } = $$props;

    	// let curState = undefined
    	// var curDriver = 0;
    	// var curNavigator = 1;
    	// var stepNumber = 1;
    	// var iterationCounter = 0;
    	// var curIteration;
    	// var step = undefined;
    	// let steps=[];
    	// var iterations=[];
    	nextStep();

    	function add4Iterations(idx) {
    		set_store_value(
    			gameState,
    			$gameState.iterations = [
    				...$gameState.iterations,
    				{ phase: 1, index: idx++ },
    				{ phase: 0, index: idx++ },
    				{ phase: 0, index: idx++ },
    				{ phase: 0, index: idx++ }
    			],
    			$gameState
    		);
    	}

    	function nextStep() {

    		set_store_value(
    			gameState,
    			$gameState.curState = !$gameState.curState
    			? states[0]
    			: states[$gameState.curState.next],
    			$gameState
    		);

    		if ($gameState.curState.id == "red") {
    			if ($gameState.curIteration) {
    				set_store_value(gameState, $gameState.curIteration.phase = 4, $gameState);
    				set_store_value(gameState, $gameState.iterationCounter++, $gameState);
    			}

    			if ($gameState.iterationCounter >= $gameState.iterations.length) {
    				add4Iterations($gameState.iterations.length + 1);
    			}

    			set_store_value(gameState, $gameState.curIteration = $gameState.iterations[$gameState.iterationCounter], $gameState);
    			set_store_value(gameState, $gameState.curIteration.phase = 1, $gameState);
    			console.log($gameState.iterations);
    		}

    		if ($gameState.curState.id == "green") {
    			set_store_value(gameState, $gameState.curIteration.phase = 2, $gameState);
    			console.log($gameState.curIteration);
    		}

    		if ($gameState.curState.id == "refactor") {
    			set_store_value(gameState, $gameState.curIteration.phase = 3, $gameState);
    		}

    		if ($gameState.curState.id == "swap") {
    			set_store_value(gameState, $gameState.curIteration.phase = 2, $gameState);
    			swapPairRoles();
    		} else {
    			addStep($gameState.curState, $gameState.stepNumber, $gameState.players[$gameState.curDriver], $gameState.players[$gameState.curNavigator]);
    			set_store_value(gameState, $gameState.stepNumber++, $gameState);
    		}

    		gameState.set($gameState);
    	}

    	function swapPairRoles() {
    		set_store_value(gameState, $gameState.curDriver++, $gameState);
    		set_store_value(gameState, $gameState.curNavigator++, $gameState);
    		set_store_value(gameState, $gameState.curDriver %= 2, $gameState);
    		set_store_value(gameState, $gameState.curNavigator %= 2, $gameState);
    		buildStepObject("Swap pair programming roles", $gameState.players[$gameState.curDriver] + " is now the driver and " + $gameState.players[$gameState.curNavigator] + " is the navigator", "Done:" + $gameState.players[$gameState.curDriver] + " has the keyboard", nextStep, "" + $gameState.curState.class + " step swap", "swap");
    	}

    	function addStep(state, stepNumber, driverName, navigatorName) {
    		buildStepObject("Step:" + stepNumber + " " + state.title, state.description + "    (" + driverName + " is driving" + ", " + navigatorName + " is navigating)", state.buttonText, nextStep, "" + state.class + " step", state.helpName);
    	}

    	function buildStepObject(title, bodyText, buttonText, buttonAction, classes, helpName) {
    		var step = new Object();

    		step = {
    			title,
    			bodyText,
    			buttonText,
    			buttonAction,
    			classes,
    			helpName
    		};

    		step.x = 42;

    		//steps.push(step)
    		set_store_value(gameState, $gameState.steps = [...$gameState.steps, step], $gameState);

    		//curStep = step;
    		//console.log(step)
    		set_store_value(gameState, $gameState.step = step, $gameState);
    	}

    	const addStepToIteration = step => {
    		
    	}; //iterationEl.children.namedItem("container").appendChild(step);

    	const writable_props = ['players'];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Game> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('players' in $$props) $$invalidate(1, players = $$props.players);
    	};

    	$$self.$capture_state = () => ({
    		Step,
    		Iteration,
    		fade,
    		gameState,
    		states,
    		players,
    		add4Iterations,
    		nextStep,
    		swapPairRoles,
    		addStep,
    		buildStepObject,
    		addStepToIteration,
    		$gameState
    	});

    	$$self.$inject_state = $$props => {
    		if ('states' in $$props) states = $$props.states;
    		if ('players' in $$props) $$invalidate(1, players = $$props.players);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [$gameState, players];
    }

    class Game extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { players: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Game",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get players() {
    		throw new Error("<Game>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set players(value) {
    		throw new Error("<Game>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.46.2 */
    const file = "src\\App.svelte";

    // (27:2) {:else}
    function create_else_block(ctx) {
    	let div;
    	let span0;
    	let label0;
    	let t1;
    	let input0;
    	let br0;
    	let t2;
    	let span1;
    	let label1;
    	let t4;
    	let input1;
    	let br1;
    	let t5;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span0 = element("span");
    			label0 = element("label");
    			label0.textContent = "Player 1";
    			t1 = space();
    			input0 = element("input");
    			br0 = element("br");
    			t2 = space();
    			span1 = element("span");
    			label1 = element("label");
    			label1.textContent = "Player 2";
    			t4 = space();
    			input1 = element("input");
    			br1 = element("br");
    			t5 = space();
    			button = element("button");
    			button.textContent = "Start Game";
    			attr_dev(label0, "for", "fname");
    			add_location(label0, file, 29, 3, 847);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "fname");
    			attr_dev(input0, "name", "fname");
    			add_location(input0, file, 30, 3, 887);
    			add_location(br0, file, 30, 67, 951);
    			add_location(span0, file, 28, 3, 836);
    			attr_dev(label1, "for", "lname");
    			add_location(label1, file, 33, 3, 981);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "lname");
    			attr_dev(input1, "name", "lname");
    			add_location(input1, file, 34, 3, 1021);
    			add_location(br1, file, 34, 67, 1085);
    			add_location(span1, file, 32, 2, 970);
    			attr_dev(button, "id", "startBtn");
    			add_location(button, file, 36, 3, 1107);
    			add_location(div, file, 27, 2, 825);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span0);
    			append_dev(span0, label0);
    			append_dev(span0, t1);
    			append_dev(span0, input0);
    			set_input_value(input0, /*player1*/ ctx[0]);
    			append_dev(span0, br0);
    			append_dev(div, t2);
    			append_dev(div, span1);
    			append_dev(span1, label1);
    			append_dev(span1, t4);
    			append_dev(span1, input1);
    			set_input_value(input1, /*player2*/ ctx[1]);
    			append_dev(span1, br1);
    			append_dev(div, t5);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[3]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[4]),
    					listen_dev(button, "click", /*click_handler*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*player1*/ 1 && input0.value !== /*player1*/ ctx[0]) {
    				set_input_value(input0, /*player1*/ ctx[0]);
    			}

    			if (dirty & /*player2*/ 2 && input1.value !== /*player2*/ ctx[1]) {
    				set_input_value(input1, /*player2*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(27:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (22:2) {#if gameBegin}
    function create_if_block(ctx) {
    	let div;
    	let game;
    	let div_transition;
    	let current;

    	game = new Game({
    			props: {
    				players: [/*player1*/ ctx[0], /*player2*/ ctx[1]]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(game.$$.fragment);
    			add_location(div, file, 22, 2, 705);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(game, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const game_changes = {};
    			if (dirty & /*player1, player2*/ 3) game_changes.players = [/*player1*/ ctx[0], /*player2*/ ctx[1]];
    			game.$set(game_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(game.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div_transition) div_transition = create_bidirectional_transition(div, fly, { y: 200, duration: 2000 }, true);
    				div_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(game.$$.fragment, local);
    			if (!div_transition) div_transition = create_bidirectional_transition(div, fly, { y: 200, duration: 2000 }, false);
    			div_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(game);
    			if (detaching && div_transition) div_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(22:2) {#if gameBegin}",
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
    	let h1;
    	let t4;
    	let h2;
    	let t6;
    	let section;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*gameBegin*/ ctx[2]) return 0;
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
    			h1 = element("h1");
    			h1.textContent = "Red-Green-Go!";
    			t4 = space();
    			h2 = element("h2");
    			h2.textContent = "A game of TDD & Pairing";
    			t6 = space();
    			section = element("section");
    			if_block.c();
    			attr_dev(link0, "rel", "preconnect");
    			attr_dev(link0, "href", "https://fonts.googleapis.com");
    			add_location(link0, file, 11, 1, 220);
    			attr_dev(link1, "rel", "preconnect");
    			attr_dev(link1, "href", "https://fonts.gstatic.com");
    			attr_dev(link1, "crossorigin", "");
    			add_location(link1, file, 12, 1, 282);
    			attr_dev(link2, "href", "https://fonts.googleapis.com/css2?family=Bangers&family=Montserrat:ital,wght@0,300;0,500;1,100;1,300;1,500&family=Roboto+Mono:ital,wght@0,277;0,300;1,300&display=swap");
    			attr_dev(link2, "rel", "stylesheet");
    			add_location(link2, file, 13, 1, 353);
    			add_location(title, file, 16, 0, 570);
    			add_location(h1, file, 18, 1, 609);
    			add_location(h2, file, 19, 1, 634);
    			add_location(section, file, 20, 1, 673);
    			attr_dev(main, "class", "svelte-ib5mzd");
    			add_location(main, file, 17, 0, 600);
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
    			append_dev(main, h1);
    			append_dev(main, t4);
    			append_dev(main, h2);
    			append_dev(main, t6);
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
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
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
    	let { player1 = "John" } = $$props;
    	let { player2 = "Jane" } = $$props;
    	let gameBegin = false;
    	const writable_props = ['player1', 'player2'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		player1 = this.value;
    		$$invalidate(0, player1);
    	}

    	function input1_input_handler() {
    		player2 = this.value;
    		$$invalidate(1, player2);
    	}

    	const click_handler = () => $$invalidate(2, gameBegin = true);

    	$$self.$$set = $$props => {
    		if ('player1' in $$props) $$invalidate(0, player1 = $$props.player1);
    		if ('player2' in $$props) $$invalidate(1, player2 = $$props.player2);
    	};

    	$$self.$capture_state = () => ({ Game, fly, player1, player2, gameBegin });

    	$$self.$inject_state = $$props => {
    		if ('player1' in $$props) $$invalidate(0, player1 = $$props.player1);
    		if ('player2' in $$props) $$invalidate(1, player2 = $$props.player2);
    		if ('gameBegin' in $$props) $$invalidate(2, gameBegin = $$props.gameBegin);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		player1,
    		player2,
    		gameBegin,
    		input0_input_handler,
    		input1_input_handler,
    		click_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { player1: 0, player2: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get player1() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set player1(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get player2() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set player2(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
