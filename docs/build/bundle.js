
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
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
    function null_to_empty(value) {
        return value == null ? '' : value;
    }
    function append(target, node) {
        target.appendChild(node);
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
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
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
    /**
     * Base class to create strongly typed Svelte components.
     * This only exists for typing purposes and should be used in `.d.ts` files.
     *
     * ### Example:
     *
     * You have component library on npm called `component-library`, from which
     * you export a component called `MyComponent`. For Svelte+TypeScript users,
     * you want to provide typings. Therefore you create a `index.d.ts`:
     * ```ts
     * import { SvelteComponentTyped } from "svelte";
     * export class MyComponent extends SvelteComponentTyped<{foo: string}> {}
     * ```
     * Typing this makes it possible for IDEs like VS Code with the Svelte extension
     * to provide intellisense and to use the component like this in a Svelte file
     * with TypeScript:
     * ```svelte
     * <script lang="ts">
     * 	import { MyComponent } from "component-library";
     * </script>
     * <MyComponent foo={'bar'} />
     * ```
     *
     * #### Why not make this part of `SvelteComponent(Dev)`?
     * Because
     * ```ts
     * class ASubclassOfSvelteComponent extends SvelteComponent<{foo: string}> {}
     * const component: typeof SvelteComponent = ASubclassOfSvelteComponent;
     * ```
     * will throw a type error, so we need to separate the more strictly typed class.
     */
    class SvelteComponentTyped extends SvelteComponentDev {
        constructor(options) {
            super(options);
        }
    }

    /* src\components\Modal.svelte generated by Svelte v3.46.2 */
    const file$5 = "src\\components\\Modal.svelte";

    function create_fragment$6(ctx) {
    	let div0;
    	let t0;
    	let div5;
    	let div4;
    	let div1;
    	let t2;
    	let div2;
    	let t3;
    	let t4;
    	let div3;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = space();
    			div5 = element("div");
    			div4 = element("div");
    			div1 = element("div");
    			div1.textContent = "REFACTOR?";
    			t2 = space();
    			div2 = element("div");
    			t3 = text(/*titleText*/ ctx[2]);
    			t4 = space();
    			div3 = element("div");
    			attr_dev(div0, "id", "background");
    			set_style(div0, "display", /*isOpenModal*/ ctx[0] ? 'block' : 'none');
    			attr_dev(div0, "class", "svelte-w4z33m");
    			add_location(div0, file$5, 18, 0, 361);
    			attr_dev(div1, "class", "cardType svelte-w4z33m");
    			add_location(div1, file$5, 26, 16, 628);
    			attr_dev(div2, "class", "title svelte-w4z33m");
    			add_location(div2, file$5, 28, 16, 702);
    			attr_dev(div3, "class", "bodyText svelte-w4z33m");
    			add_location(div3, file$5, 29, 16, 759);
    			attr_dev(div4, "id", "modal");
    			attr_dev(div4, "class", "svelte-w4z33m");
    			add_location(div4, file$5, 25, 12, 594);
    			attr_dev(div5, "id", "frame");
    			set_style(div5, "display", /*isOpenModal*/ ctx[0] ? 'block' : 'none');
    			attr_dev(div5, "class", "svelte-w4z33m");
    			add_location(div5, file$5, 23, 0, 500);
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
    			append_dev(div4, t2);
    			append_dev(div4, div2);
    			append_dev(div2, t3);
    			append_dev(div4, t4);
    			append_dev(div4, div3);
    			div3.innerHTML = /*bodyText*/ ctx[1];

    			if (!mounted) {
    				dispose = listen_dev(div0, "click", /*closeModal*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*isOpenModal*/ 1) {
    				set_style(div0, "display", /*isOpenModal*/ ctx[0] ? 'block' : 'none');
    			}

    			if (dirty & /*titleText*/ 4) set_data_dev(t3, /*titleText*/ ctx[2]);
    			if (dirty & /*bodyText*/ 2) div3.innerHTML = /*bodyText*/ ctx[1];
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
    	const dispatch = createEventDispatcher();

    	function closeModal() {
    		$$invalidate(0, isOpenModal = false);
    		dispatch('closeModal', { isOpenModal });
    	}

    	const writable_props = ['isOpenModal', 'bodyText', 'titleText'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('isOpenModal' in $$props) $$invalidate(0, isOpenModal = $$props.isOpenModal);
    		if ('bodyText' in $$props) $$invalidate(1, bodyText = $$props.bodyText);
    		if ('titleText' in $$props) $$invalidate(2, titleText = $$props.titleText);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		isOpenModal,
    		bodyText,
    		titleText,
    		dispatch,
    		closeModal
    	});

    	$$self.$inject_state = $$props => {
    		if ('isOpenModal' in $$props) $$invalidate(0, isOpenModal = $$props.isOpenModal);
    		if ('bodyText' in $$props) $$invalidate(1, bodyText = $$props.bodyText);
    		if ('titleText' in $$props) $$invalidate(2, titleText = $$props.titleText);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [isOpenModal, bodyText, titleText, closeModal];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {
    			isOpenModal: 0,
    			bodyText: 1,
    			titleText: 2
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

    /* src\components\HintCard.svelte generated by Svelte v3.46.2 */

    const { console: console_1$1 } = globals;

    function create_fragment$5(ctx) {
    	let modal;
    	let current;

    	modal = new Modal({
    			props: {
    				isOpenModal: /*show*/ ctx[0],
    				titleText: /*titleText*/ ctx[2],
    				bodyText: /*bodyText*/ ctx[1]
    			},
    			$$inline: true
    		});

    	modal.$on("closeModal", /*closeModal*/ ctx[3]);

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
    			if (dirty & /*show*/ 1) modal_changes.isOpenModal = /*show*/ ctx[0];
    			if (dirty & /*titleText*/ 4) modal_changes.titleText = /*titleText*/ ctx[2];
    			if (dirty & /*bodyText*/ 2) modal_changes.bodyText = /*bodyText*/ ctx[1];
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
    	let show = false;
    	let bodyText = "";
    	let titleText = "";

    	function closeModal() {
    		$$invalidate(0, show = false);
    	}

    	const writable_props = ['showHint'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<HintCard> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('showHint' in $$props) $$invalidate(4, showHint = $$props.showHint);
    	};

    	$$self.$capture_state = () => ({
    		Modal,
    		refactorCards,
    		showHint,
    		show,
    		bodyText,
    		titleText,
    		closeModal
    	});

    	$$self.$inject_state = $$props => {
    		if ('showHint' in $$props) $$invalidate(4, showHint = $$props.showHint);
    		if ('show' in $$props) $$invalidate(0, show = $$props.show);
    		if ('bodyText' in $$props) $$invalidate(1, bodyText = $$props.bodyText);
    		if ('titleText' in $$props) $$invalidate(2, titleText = $$props.titleText);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*showHint*/ 16) {
    			{
    				if (showHint) $$invalidate(0, show = true);
    				let idx = Math.round((refactorCards.length - 1) * Math.random());
    				console.log(idx);
    				let card = refactorCards[idx];
    				$$invalidate(1, bodyText = card.description);
    				$$invalidate(2, titleText = card.title);
    			}
    		}
    	};

    	return [show, bodyText, titleText, closeModal, showHint];
    }

    class HintCard extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { showHint: 4 });

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
    }

    /* src\components\Step.svelte generated by Svelte v3.46.2 */
    const file$4 = "src\\components\\Step.svelte";

    function create_fragment$4(ctx) {
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
    	let current;
    	let mounted;
    	let dispose;

    	hintcard = new HintCard({
    			props: { showHint: /*showHint*/ ctx[1] },
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
    			attr_dev(p0, "class", "title svelte-16pc8zp");
    			add_location(p0, file$4, 15, 4, 306);
    			attr_dev(p1, "class", "svelte-16pc8zp");
    			add_location(p1, file$4, 18, 8, 386);
    			add_location(button0, file$4, 19, 8, 418);
    			add_location(button1, file$4, 20, 8, 491);
    			attr_dev(div0, "class", "stepBody svelte-16pc8zp");
    			add_location(div0, file$4, 17, 4, 353);
    			attr_dev(div1, "class", div1_class_value = "" + (null_to_empty(/*step*/ ctx[0].classes) + " svelte-16pc8zp"));
    			add_location(div1, file$4, 14, 0, 272);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
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
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*step*/ 1) && t0_value !== (t0_value = /*step*/ ctx[0].title + "")) set_data_dev(t0, t0_value);
    			if ((!current || dirty & /*step*/ 1) && t2_value !== (t2_value = /*step*/ ctx[0].bodyText + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty & /*step*/ 1) && t4_value !== (t4_value = /*step*/ ctx[0].buttonText + "")) set_data_dev(t4, t4_value);
    			const hintcard_changes = {};
    			if (dirty & /*showHint*/ 2) hintcard_changes.showHint = /*showHint*/ ctx[1];
    			hintcard.$set(hintcard_changes);

    			if (!current || dirty & /*step*/ 1 && div1_class_value !== (div1_class_value = "" + (null_to_empty(/*step*/ ctx[0].classes) + " svelte-16pc8zp"))) {
    				attr_dev(div1, "class", div1_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(hintcard.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(hintcard.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(hintcard);
    			mounted = false;
    			run_all(dispose);
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

    	$$self.$capture_state = () => ({ HintCard, tick, step, showHint, showCard });

    	$$self.$inject_state = $$props => {
    		if ('step' in $$props) $$invalidate(0, step = $$props.step);
    		if ('showHint' in $$props) $$invalidate(1, showHint = $$props.showHint);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
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

    // (51:4) {#if phase == 1}
    function create_if_block_3(ctx) {
    	let animate;

    	const block = {
    		c: function create() {
    			animate = svg_element("animate");
    			attr_dev(animate, "attributeName", "fill");
    			attr_dev(animate, "values", "white;" + phase1Col + ";white");
    			attr_dev(animate, "dur", "3s");
    			attr_dev(animate, "repeatCount", "indefinite");
    			add_location(animate, file$3, 51, 5, 1537);
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
    		source: "(51:4) {#if phase == 1}",
    		ctx
    	});

    	return block;
    }

    // (60:3) {#if phase == 2}
    function create_if_block_2(ctx) {
    	let animate;

    	const block = {
    		c: function create() {
    			animate = svg_element("animate");
    			attr_dev(animate, "attributeName", "fill");
    			attr_dev(animate, "values", "white;" + phase2Col + ";white");
    			attr_dev(animate, "dur", "3s");
    			attr_dev(animate, "repeatCount", "indefinite");
    			add_location(animate, file$3, 60, 3, 1798);
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
    		source: "(60:3) {#if phase == 2}",
    		ctx
    	});

    	return block;
    }

    // (67:3) {#if phase == 3}
    function create_if_block_1(ctx) {
    	let animate;

    	const block = {
    		c: function create() {
    			animate = svg_element("animate");
    			attr_dev(animate, "attributeName", "fill");
    			attr_dev(animate, "values", "white;" + phase3Col + ";white");
    			attr_dev(animate, "dur", "3s");
    			attr_dev(animate, "repeatCount", "indefinite");
    			add_location(animate, file$3, 67, 3, 2043);
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
    		source: "(67:3) {#if phase == 3}",
    		ctx
    	});

    	return block;
    }

    // (72:3) {#if phase == 4}
    function create_if_block$1(ctx) {
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
    			add_location(animateTransform, file$3, 72, 4, 2192);
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
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(72:3) {#if phase == 4}",
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
    	let text_1;
    	let t;
    	let path;
    	let g1;
    	let g0;
    	let use0;
    	let use1;
    	let use2;
    	let if_block0 = /*phase*/ ctx[0] == 1 && create_if_block_3(ctx);
    	let if_block1 = /*phase*/ ctx[0] == 2 && create_if_block_2(ctx);
    	let if_block2 = /*phase*/ ctx[0] == 3 && create_if_block_1(ctx);
    	let if_block3 = /*phase*/ ctx[0] == 4 && create_if_block$1(ctx);

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
    			text_1 = svg_element("text");
    			t = text(/*text*/ ctx[1]);
    			path = svg_element("path");
    			g1 = svg_element("g");
    			g0 = svg_element("g");
    			use0 = svg_element("use");
    			if (if_block0) if_block0.c();
    			use1 = svg_element("use");
    			if (if_block1) if_block1.c();
    			use2 = svg_element("use");
    			if (if_block2) if_block2.c();
    			if (if_block3) if_block3.c();
    			attr_dev(polygon0, "points", "0 0, 1.5 1, 0 2");
    			attr_dev(polygon0, "fill", "tomato");
    			add_location(polygon0, file$3, 20, 6, 570);
    			attr_dev(marker0, "id", "arrowheadred");
    			attr_dev(marker0, "markerWidth", "1.5");
    			attr_dev(marker0, "markerHeight", "2");
    			attr_dev(marker0, "refX", "0.5");
    			attr_dev(marker0, "refY", "1");
    			attr_dev(marker0, "orient", "auto");
    			add_location(marker0, file$3, 18, 4, 461);
    			attr_dev(polygon1, "points", "0 0, 1.5 1, 0 2");
    			attr_dev(polygon1, "fill", "olivedrab");
    			add_location(polygon1, file$3, 24, 6, 757);
    			attr_dev(marker1, "id", "arrowheadgreen");
    			attr_dev(marker1, "markerWidth", "1.5");
    			attr_dev(marker1, "markerHeight", "2");
    			attr_dev(marker1, "refX", "0.5");
    			attr_dev(marker1, "refY", "1");
    			attr_dev(marker1, "orient", "auto");
    			add_location(marker1, file$3, 22, 7, 646);
    			attr_dev(polygon2, "points", "0 0, 1.5 1, 0 2");
    			attr_dev(polygon2, "fill", "dodgerblue");
    			add_location(polygon2, file$3, 28, 6, 944);
    			attr_dev(marker2, "id", "arrowheadblue");
    			attr_dev(marker2, "markerWidth", "1.5");
    			attr_dev(marker2, "markerHeight", "2");
    			attr_dev(marker2, "refX", "0.5");
    			attr_dev(marker2, "refY", "1");
    			attr_dev(marker2, "orient", "auto");
    			add_location(marker2, file$3, 26, 7, 834);
    			add_location(defs, file$3, 17, 3, 449);
    			attr_dev(text_1, "x", "0");
    			attr_dev(text_1, "y", "0");
    			attr_dev(text_1, "transform", "translate(74 91) scale(2.6,2.6)");
    			set_style(text_1, "text-anchor", "middle");
    			add_location(text_1, file$3, 33, 2, 1038);
    			attr_dev(path, "id", "arrow");
    			attr_dev(path, "d", "M 0 -0.75\r\n\t\t\t\t\t\tl 0 -0.5\r\n\t\t\t\tA 1.25 1.25, 0, 0, 0, -1.2 -0.21\r\n\t\t\t\t\t\tl -0.25 0, 0.45 0.7 0.45 -0.7 -0.2 0\r\n\t\t\t\t\t\tA 0.75 0.75, 0, 0, 1, 0 -0.75\r\n\t\t\t\t\t\t");
    			attr_dev(path, "stroke-width", "0.02");
    			add_location(path, file$3, 34, 2, 1145);
    			attr_dev(use0, "href", "#arrow");
    			attr_dev(use0, "fill", /*phase1FillCol*/ ctx[2]);
    			attr_dev(use0, "stroke", phase1Col);
    			add_location(use0, file$3, 47, 3, 1434);
    			attr_dev(use1, "href", "#arrow");
    			attr_dev(use1, "fill", /*phase2FillCol*/ ctx[3]);
    			attr_dev(use1, "stroke", phase2Col);
    			attr_dev(use1, "transform", "rotate(-120)");
    			add_location(use1, file$3, 55, 3, 1668);
    			attr_dev(use2, "href", "#arrow");
    			attr_dev(use2, "stroke", phase3Col);
    			attr_dev(use2, "fill", /*phase3FillCol*/ ctx[4]);
    			attr_dev(use2, "transform", "rotate(120)");
    			add_location(use2, file$3, 65, 3, 1931);
    			add_location(g0, file$3, 46, 3, 1426);
    			attr_dev(g1, "transform", "\r\n\t\t\ttranslate(75 75)\r\n            scale(50 -50)");
    			add_location(g1, file$3, 43, 2, 1356);
    			add_location(g2, file$3, 32, 2, 1030);
    			attr_dev(svg, "height", "150");
    			attr_dev(svg, "width", "150");
    			add_location(svg, file$3, 16, 0, 414);
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
    			append_dev(g2, text_1);
    			append_dev(text_1, t);
    			append_dev(g2, path);
    			append_dev(g2, g1);
    			append_dev(g1, g0);
    			append_dev(g0, use0);
    			if (if_block0) if_block0.m(use0, null);
    			append_dev(g0, use1);
    			if (if_block1) if_block1.m(use1, null);
    			append_dev(g0, use2);
    			if (if_block2) if_block2.m(use2, null);
    			if (if_block3) if_block3.m(g0, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*text*/ 2) set_data_dev(t, /*text*/ ctx[1]);

    			if (/*phase*/ ctx[0] == 1) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_3(ctx);
    					if_block0.c();
    					if_block0.m(use0, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty & /*phase1FillCol*/ 4) {
    				attr_dev(use0, "fill", /*phase1FillCol*/ ctx[2]);
    			}

    			if (/*phase*/ ctx[0] == 2) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					if_block1.m(use1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*phase2FillCol*/ 8) {
    				attr_dev(use1, "fill", /*phase2FillCol*/ ctx[3]);
    			}

    			if (/*phase*/ ctx[0] == 3) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_1(ctx);
    					if_block2.c();
    					if_block2.m(use2, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty & /*phase3FillCol*/ 16) {
    				attr_dev(use2, "fill", /*phase3FillCol*/ ctx[4]);
    			}

    			if (/*phase*/ ctx[0] == 4) {
    				if (if_block3) ; else {
    					if_block3 = create_if_block$1(ctx);
    					if_block3.c();
    					if_block3.m(g0, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
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
    	let phase1FillCol = phase1Col;
    	let phase2FillCol = phase2Col;
    	let phase3FillCol = phase3Col;
    	const writable_props = ['phase', 'text'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TDDCycle> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('phase' in $$props) $$invalidate(0, phase = $$props.phase);
    		if ('text' in $$props) $$invalidate(1, text = $$props.text);
    	};

    	$$self.$capture_state = () => ({
    		phase,
    		text,
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
    		if ('phase1FillCol' in $$props) $$invalidate(2, phase1FillCol = $$props.phase1FillCol);
    		if ('phase2FillCol' in $$props) $$invalidate(3, phase2FillCol = $$props.phase2FillCol);
    		if ('phase3FillCol' in $$props) $$invalidate(4, phase3FillCol = $$props.phase3FillCol);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*phase*/ 1) {
    			{
    				$$invalidate(2, phase1FillCol = phase < 2 ? "white" : phase1Col);
    				$$invalidate(3, phase2FillCol = phase < 3 ? "white" : phase2Col);
    				$$invalidate(4, phase3FillCol = phase < 4 ? "white" : phase3Col);
    			}
    		}
    	};

    	return [phase, text, phase1FillCol, phase2FillCol, phase3FillCol];
    }

    class TDDCycle extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { phase: 0, text: 1 });

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
    }

    /* src\components\Iteration.svelte generated by Svelte v3.46.2 */
    const file$2 = "src\\components\\Iteration.svelte";

    function create_fragment$2(ctx) {
    	let div;
    	let tddcycle;
    	let t0;
    	let p;
    	let t1;
    	let t2;
    	let current;

    	tddcycle = new TDDCycle({
    			props: {
    				phase: /*phase*/ ctx[1],
    				text: /*iterationCounter*/ ctx[0]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(tddcycle.$$.fragment);
    			t0 = space();
    			p = element("p");
    			t1 = text("Iteration: ");
    			t2 = text(/*iterationCounter*/ ctx[0]);
    			attr_dev(p, "class", "title");
    			add_location(p, file$2, 8, 4, 229);
    			attr_dev(div, "class", "iteration svelte-zs0rw3");
    			add_location(div, file$2, 6, 0, 133);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(tddcycle, div, null);
    			append_dev(div, t0);
    			append_dev(div, p);
    			append_dev(p, t1);
    			append_dev(p, t2);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const tddcycle_changes = {};
    			if (dirty & /*phase*/ 2) tddcycle_changes.phase = /*phase*/ ctx[1];
    			if (dirty & /*iterationCounter*/ 1) tddcycle_changes.text = /*iterationCounter*/ ctx[0];
    			tddcycle.$set(tddcycle_changes);
    			if (!current || dirty & /*iterationCounter*/ 1) set_data_dev(t2, /*iterationCounter*/ ctx[0]);
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
    			if (detaching) detach_dev(div);
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
    	const writable_props = ['iterationCounter', 'phase'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Iteration> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('iterationCounter' in $$props) $$invalidate(0, iterationCounter = $$props.iterationCounter);
    		if ('phase' in $$props) $$invalidate(1, phase = $$props.phase);
    	};

    	$$self.$capture_state = () => ({ TDDCycle, iterationCounter, phase });

    	$$self.$inject_state = $$props => {
    		if ('iterationCounter' in $$props) $$invalidate(0, iterationCounter = $$props.iterationCounter);
    		if ('phase' in $$props) $$invalidate(1, phase = $$props.phase);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [iterationCounter, phase];
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

    /* src\components\Game.svelte generated by Svelte v3.46.2 */

    const { Object: Object_1, console: console_1 } = globals;
    const file$1 = "src\\components\\Game.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i];
    	return child_ctx;
    }

    // (127:0) {#each iterations as i}
    function create_each_block(ctx) {
    	let iteration;
    	let current;

    	iteration = new Iteration({
    			props: {
    				iterationCounter: /*i*/ ctx[17].index,
    				phase: /*i*/ ctx[17].phase
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
    			if (dirty & /*iterations*/ 2) iteration_changes.iterationCounter = /*i*/ ctx[17].index;
    			if (dirty & /*iterations*/ 2) iteration_changes.phase = /*i*/ ctx[17].phase;
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
    		source: "(127:0) {#each iterations as i}",
    		ctx
    	});

    	return block;
    }

    // (132:0) {#if step}
    function create_if_block(ctx) {
    	let step_1;
    	let current;

    	step_1 = new Step({
    			props: { step: /*step*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(step_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(step_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const step_1_changes = {};
    			if (dirty & /*step*/ 1) step_1_changes.step = /*step*/ ctx[0];
    			step_1.$set(step_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(step_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(step_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(step_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(132:0) {#if step}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let h1;
    	let t1;
    	let h2;
    	let t3;
    	let section;
    	let form;
    	let label0;
    	let t5;
    	let input0;
    	let br0;
    	let t6;
    	let label1;
    	let t8;
    	let input1;
    	let br1;
    	let t9;
    	let input2;
    	let t10;
    	let div0;
    	let t11;
    	let div1;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*iterations*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let if_block = /*step*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Red-Green-Go!";
    			t1 = space();
    			h2 = element("h2");
    			h2.textContent = "A game of TDD & Pairing";
    			t3 = space();
    			section = element("section");
    			form = element("form");
    			label0 = element("label");
    			label0.textContent = "Player 1 name:";
    			t5 = space();
    			input0 = element("input");
    			br0 = element("br");
    			t6 = space();
    			label1 = element("label");
    			label1.textContent = "Player 2 name:";
    			t8 = space();
    			input1 = element("input");
    			br1 = element("br");
    			t9 = space();
    			input2 = element("input");
    			t10 = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t11 = space();
    			div1 = element("div");
    			if (if_block) if_block.c();
    			add_location(h1, file$1, 114, 0, 3421);
    			add_location(h2, file$1, 115, 0, 3445);
    			attr_dev(label0, "for", "fname");
    			add_location(label0, file$1, 118, 4, 3507);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "fname");
    			attr_dev(input0, "name", "fname");
    			input0.value = "John";
    			add_location(input0, file$1, 119, 4, 3554);
    			add_location(br0, file$1, 119, 60, 3610);
    			attr_dev(label1, "for", "lname");
    			add_location(label1, file$1, 120, 4, 3620);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "lname");
    			attr_dev(input1, "name", "lname");
    			input1.value = "Jane";
    			add_location(input1, file$1, 121, 4, 3667);
    			add_location(br1, file$1, 121, 60, 3723);
    			attr_dev(input2, "id", "startBtn");
    			attr_dev(input2, "name", "Submit");
    			attr_dev(input2, "type", "submit");
    			input2.value = "Start";
    			add_location(input2, file$1, 122, 4, 3733);
    			add_location(form, file$1, 117, 0, 3494);
    			add_location(section, file$1, 116, 0, 3483);
    			attr_dev(div0, "class", "iterations svelte-14wazpl");
    			add_location(div0, file$1, 125, 0, 3845);
    			add_location(div1, file$1, 130, 0, 3978);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, section, anchor);
    			append_dev(section, form);
    			append_dev(form, label0);
    			append_dev(form, t5);
    			append_dev(form, input0);
    			append_dev(form, br0);
    			append_dev(form, t6);
    			append_dev(form, label1);
    			append_dev(form, t8);
    			append_dev(form, input1);
    			append_dev(form, br1);
    			append_dev(form, t9);
    			append_dev(form, input2);
    			insert_dev(target, t10, anchor);
    			insert_dev(target, div0, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			insert_dev(target, t11, anchor);
    			insert_dev(target, div1, anchor);
    			if (if_block) if_block.m(div1, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(input2, "click", /*startGame*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*iterations*/ 2) {
    				each_value = /*iterations*/ ctx[1];
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

    			if (/*step*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*step*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
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
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(section);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(div0);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
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
    	validate_slots('Game', slots, []);

    	var states = [
    		{
    			name: "Red",
    			class: "red",
    			next: 1,
    			description: "Write the simplest test you can think of that will fail",
    			buttonText: "Done: There is ONE failing (red) test"
    		},
    		{
    			name: "Swap",
    			class: "swap",
    			next: 2,
    			description: "Swap the roles of driver and navigator",
    			buttonText: ""
    		},
    		{
    			name: "Green",
    			class: "green",
    			next: 3,
    			description: "Write just enough code to make the failing test pass",
    			buttonText: "Done: All the test are now passing (green)"
    		},
    		{
    			name: "Refactor",
    			class: "refactor",
    			next: 0,
    			description: "Clean up the code you've just written",
    			buttonText: "Done: The code is better and all tests are still passing!"
    		}
    	];

    	var players = ["John", "Jane"];
    	let curState = undefined;
    	var curDriver = 0;
    	var curNavigator = 1;
    	var stepNumber = 1;
    	var iterationCounter = 1;
    	var curIteration;
    	var step = undefined;
    	let steps = [];
    	var iterations = [];

    	function startGame() {
    		document.getElementById("startBtn").disabled = true;
    		document.getElementById("startBtn").style.display = "none";
    		nextStep();
    	}

    	function nextStep() {
    		$$invalidate(0, step = new Object());

    		if (!curState) {
    			curState = states[0];
    		} else {
    			curState = states[curState.next];
    		}

    		if (curState.name == "Red") {
    			if (curIteration) {
    				curIteration.phase = 4;
    			}

    			curIteration = { phase: 1, index: iterationCounter };
    			$$invalidate(1, iterations = [...iterations, curIteration]);
    			iterationCounter++;
    			console.log(iterations);
    		}

    		if (curState.name == "Green") {
    			curIteration.phase = 2;
    			console.log(curIteration);
    		}

    		if (curState.name == "Refactor") {
    			curIteration.phase = 3;
    		}

    		if (curState.name == "Swap") {
    			curIteration.phase = 2;
    			swapPairRoles();
    		} else {
    			addStep(curState, stepNumber, players[curDriver], players[curNavigator]);
    			stepNumber++;
    		}

    		$$invalidate(1, iterations);
    	}

    	function swapPairRoles() {
    		curDriver++;
    		curNavigator++;
    		curDriver %= 2;
    		curNavigator %= 2;
    		$$invalidate(0, step = buildStepObject("Swap pair programming roles", players[curDriver] + " is now the driver and " + players[curNavigator] + " is the navigator", "Done:" + players[curDriver] + " has the keyboard", nextStep, "" + curState.class + " step swap"));
    	}

    	function addStep(state, stepNumber, driverName, navigatorName) {
    		$$invalidate(0, step = buildStepObject("Step:" + stepNumber + " " + state.name, state.description + "    (" + driverName + " is driving" + ", " + navigatorName + " is navigating)", state.buttonText, nextStep, "" + state.class + " step"));
    	}

    	function buildStepObject(title, bodyText, buttonText, buttonAction, classes) {
    		$$invalidate(0, step = new Object());

    		$$invalidate(0, step = {
    			title,
    			bodyText,
    			buttonText,
    			buttonAction,
    			classes
    		});

    		$$invalidate(0, step.x = 42, step);

    		//steps.push(step)
    		steps = [...steps, step];

    		//curStep = step;
    		//console.log(step)
    		return step;
    	}

    	const addStepToIteration = step => {
    		
    	}; //iterationEl.children.namedItem("container").appendChild(step);

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Game> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Step,
    		Iteration,
    		SvelteComponentTyped,
    		states,
    		players,
    		curState,
    		curDriver,
    		curNavigator,
    		stepNumber,
    		iterationCounter,
    		curIteration,
    		step,
    		steps,
    		iterations,
    		startGame,
    		nextStep,
    		swapPairRoles,
    		addStep,
    		buildStepObject,
    		addStepToIteration
    	});

    	$$self.$inject_state = $$props => {
    		if ('states' in $$props) states = $$props.states;
    		if ('players' in $$props) players = $$props.players;
    		if ('curState' in $$props) curState = $$props.curState;
    		if ('curDriver' in $$props) curDriver = $$props.curDriver;
    		if ('curNavigator' in $$props) curNavigator = $$props.curNavigator;
    		if ('stepNumber' in $$props) stepNumber = $$props.stepNumber;
    		if ('iterationCounter' in $$props) iterationCounter = $$props.iterationCounter;
    		if ('curIteration' in $$props) curIteration = $$props.curIteration;
    		if ('step' in $$props) $$invalidate(0, step = $$props.step);
    		if ('steps' in $$props) steps = $$props.steps;
    		if ('iterations' in $$props) $$invalidate(1, iterations = $$props.iterations);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [step, iterations, startGame];
    }

    class Game extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Game",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.46.2 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let link0;
    	let link1;
    	let link2;
    	let t0;
    	let title;
    	let t2;
    	let main;
    	let game;
    	let current;
    	game = new Game({ $$inline: true });

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
    			create_component(game.$$.fragment);
    			attr_dev(link0, "rel", "preconnect");
    			attr_dev(link0, "href", "https://fonts.googleapis.com");
    			add_location(link0, file, 7, 1, 109);
    			attr_dev(link1, "rel", "preconnect");
    			attr_dev(link1, "href", "https://fonts.gstatic.com");
    			attr_dev(link1, "crossorigin", "");
    			add_location(link1, file, 8, 1, 171);
    			attr_dev(link2, "href", "https://fonts.googleapis.com/css2?family=Bangers&family=Montserrat:ital,wght@0,300;0,500;1,100;1,300;1,500&family=Roboto+Mono:ital,wght@0,277;0,300;1,300&display=swap");
    			attr_dev(link2, "rel", "stylesheet");
    			add_location(link2, file, 9, 1, 242);
    			add_location(title, file, 12, 0, 459);
    			attr_dev(main, "class", "svelte-1amlc8f");
    			add_location(main, file, 13, 0, 489);
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
    			mount_component(game, main, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(game.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(game.$$.fragment, local);
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
    			destroy_component(game);
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
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Game });
    	return [];
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
