
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
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
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

    /* src\components\Step.svelte generated by Svelte v3.46.2 */

    const { console: console_1 } = globals;
    const file$3 = "src\\components\\Step.svelte";

    function create_fragment$3(ctx) {
    	let div1;
    	let p0;
    	let t1;
    	let div0;
    	let p1;
    	let t3;
    	let button;
    	let div1_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			p0 = element("p");
    			p0.textContent = `${/*title*/ ctx[1]}`;
    			t1 = space();
    			div0 = element("div");
    			p1 = element("p");
    			p1.textContent = `${/*bodyText*/ ctx[2]}`;
    			t3 = space();
    			button = element("button");
    			button.textContent = `${/*buttonText*/ ctx[3]}`;
    			attr_dev(p0, "class", "title svelte-1ppxaxr");
    			add_location(p0, file$3, 12, 4, 262);
    			attr_dev(p1, "class", "svelte-1ppxaxr");
    			add_location(p1, file$3, 15, 8, 337);
    			add_location(button, file$3, 16, 8, 364);
    			attr_dev(div0, "class", "stepBody svelte-1ppxaxr");
    			add_location(div0, file$3, 14, 4, 304);
    			attr_dev(div1, "class", div1_class_value = "" + (null_to_empty(/*classesStr*/ ctx[0]) + " svelte-1ppxaxr"));
    			add_location(div1, file$3, 11, 0, 230);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, p0);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, p1);
    			append_dev(div0, t3);
    			append_dev(div0, button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*buttonAction*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*classesStr*/ 1 && div1_class_value !== (div1_class_value = "" + (null_to_empty(/*classesStr*/ ctx[0]) + " svelte-1ppxaxr"))) {
    				attr_dev(div1, "class", div1_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			dispose();
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
    	validate_slots('Step', slots, []);
    	let { step } = $$props;
    	const { title, bodyText, buttonText, buttonAction, classes } = step;
    	let classesStr = "";
    	console.log(classes);
    	classes.forEach(c => $$invalidate(0, classesStr += c + " "));
    	const writable_props = ['step'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Step> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('step' in $$props) $$invalidate(5, step = $$props.step);
    	};

    	$$self.$capture_state = () => ({
    		step,
    		title,
    		bodyText,
    		buttonText,
    		buttonAction,
    		classes,
    		classesStr
    	});

    	$$self.$inject_state = $$props => {
    		if ('step' in $$props) $$invalidate(5, step = $$props.step);
    		if ('classesStr' in $$props) $$invalidate(0, classesStr = $$props.classesStr);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [classesStr, title, bodyText, buttonText, buttonAction, step];
    }

    class Step extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { step: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Step",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*step*/ ctx[5] === undefined && !('step' in props)) {
    			console_1.warn("<Step> was created without expected prop 'step'");
    		}
    	}

    	get step() {
    		throw new Error("<Step>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set step(value) {
    		throw new Error("<Step>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Iteration.svelte generated by Svelte v3.46.2 */

    const file$2 = "src\\components\\Iteration.svelte";

    function create_fragment$2(ctx) {
    	let div1;
    	let p;
    	let t0;
    	let t1;
    	let t2;
    	let div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			p = element("p");
    			t0 = text("Iteration: ");
    			t1 = text(/*iterationCounter*/ ctx[0]);
    			t2 = space();
    			div0 = element("div");
    			attr_dev(p, "class", "title");
    			add_location(p, file$2, 5, 4, 85);
    			attr_dev(div0, "class", "container svelte-ibrt7i");
    			attr_dev(div0, "id", "container");
    			add_location(div0, file$2, 8, 4, 157);
    			attr_dev(div1, "class", "iteration svelte-ibrt7i");
    			add_location(div1, file$2, 4, 0, 56);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, p);
    			append_dev(p, t0);
    			append_dev(p, t1);
    			append_dev(div1, t2);
    			append_dev(div1, div0);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*iterationCounter*/ 1) set_data_dev(t1, /*iterationCounter*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
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
    	let { iterationCounter } = $$props;
    	const writable_props = ['iterationCounter'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Iteration> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('iterationCounter' in $$props) $$invalidate(0, iterationCounter = $$props.iterationCounter);
    	};

    	$$self.$capture_state = () => ({ iterationCounter });

    	$$self.$inject_state = $$props => {
    		if ('iterationCounter' in $$props) $$invalidate(0, iterationCounter = $$props.iterationCounter);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [iterationCounter];
    }

    class Iteration extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { iterationCounter: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Iteration",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*iterationCounter*/ ctx[0] === undefined && !('iterationCounter' in props)) {
    			console.warn("<Iteration> was created without expected prop 'iterationCounter'");
    		}
    	}

    	get iterationCounter() {
    		throw new Error("<Iteration>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set iterationCounter(value) {
    		throw new Error("<Iteration>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Game.svelte generated by Svelte v3.46.2 */
    const file$1 = "src\\components\\Game.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[20] = list[i];
    	return child_ctx;
    }

    // (112:0) {#each iterations as i}
    function create_each_block_1(ctx) {
    	let iteration;
    	let current;

    	iteration = new Iteration({
    			props: { iterationCounter: /*i*/ ctx[20] },
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
    			if (dirty & /*iterations*/ 2) iteration_changes.iterationCounter = /*i*/ ctx[20];
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
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(112:0) {#each iterations as i}",
    		ctx
    	});

    	return block;
    }

    // (116:0) {#each steps as step}
    function create_each_block(ctx) {
    	let step;
    	let current;

    	step = new Step({
    			props: { step: /*step*/ ctx[17] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(step.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(step, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const step_changes = {};
    			if (dirty & /*steps*/ 1) step_changes.step = /*step*/ ctx[17];
    			step.$set(step_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(step.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(step.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(step, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(116:0) {#each steps as step}",
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
    	let div;
    	let t11;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*iterations*/ ctx[1];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	let each_value = /*steps*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out_1 = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

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
    			div = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t11 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(h1, file$1, 99, 0, 3035);
    			add_location(h2, file$1, 100, 0, 3059);
    			attr_dev(label0, "for", "fname");
    			add_location(label0, file$1, 103, 4, 3121);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "fname");
    			attr_dev(input0, "name", "fname");
    			input0.value = "John";
    			add_location(input0, file$1, 104, 4, 3168);
    			add_location(br0, file$1, 104, 60, 3224);
    			attr_dev(label1, "for", "lname");
    			add_location(label1, file$1, 105, 4, 3234);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "lname");
    			attr_dev(input1, "name", "lname");
    			input1.value = "Jane";
    			add_location(input1, file$1, 106, 4, 3281);
    			add_location(br1, file$1, 106, 60, 3337);
    			attr_dev(input2, "id", "startBtn");
    			attr_dev(input2, "name", "Submit");
    			attr_dev(input2, "type", "submit");
    			input2.value = "Start";
    			add_location(input2, file$1, 107, 4, 3347);
    			add_location(form, file$1, 102, 0, 3108);
    			add_location(section, file$1, 101, 0, 3097);
    			add_location(div, file$1, 110, 0, 3459);
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
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div, null);
    			}

    			append_dev(div, t11);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(input2, "click", /*startGame*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*iterations*/ 2) {
    				each_value_1 = /*iterations*/ ctx[1];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						transition_in(each_blocks_1[i], 1);
    						each_blocks_1[i].m(div, t11);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks_1.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (dirty & /*steps*/ 1) {
    				each_value = /*steps*/ ctx[0];
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
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out_1(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks_1 = each_blocks_1.filter(Boolean);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out(each_blocks_1[i]);
    			}

    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(section);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
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
    			buttonText: "Done: All the test are now passing (green)"
    		},
    		{
    			name: "Green",
    			class: "green",
    			next: 3,
    			description: "Write just enough code to make the failing test pass"
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
    	var curState = states[0];
    	var curDriver = 0;
    	var curNavigator = 1;
    	var stepNumber = 1;
    	var iterationCounter = 1;
    	var iterationEl;
    	var curStep;
    	var steps = [];
    	var iterations = [];

    	function startGame() {
    		document.getElementById("startBtn").disabled = true;
    		document.getElementById("startBtn").style.display = "none";
    		nextStep();
    	}

    	function nextStep() {
    		if (curStep) {
    			//iterationEl.removeChild(iterationEl.lastChild);
    			addStep(curState, stepNumber, players[curDriver], players[curNavigator]);

    			stepNumber++;
    		}

    		if (curState.name == "Red") {
    			iterations.push(iterationCounter);
    			$$invalidate(1, iterations);
    			iterationCounter++;
    		}

    		if (curState.name == "Swap") {
    			swapPairRoles();
    		} else {
    			addStep(curState, stepNumber, players[curDriver], players[curNavigator]);
    			stepNumber++;
    		}

    		curState = states[curState.next];
    	}

    	function swapPairRoles() {
    		curDriver++;
    		curNavigator++;
    		curDriver %= 2;
    		curNavigator %= 2;
    		const newStep = buildStepElement("Swap pair programming roles", players[curDriver] + " is now the driver and " + players[curNavigator] + " is the navigator", "Done:" + players[curDriver] + " has the keyboard", nextStep, [curState.class, "step", "swap"]);
    		curStep = newStep;
    	} //iterationEl.appendChild(newStep);

    	function addStep(state, stepNumber, driverName, navigatorName) {
    		const newStep = buildStepElement("Step:" + stepNumber + " " + state.name, state.description + "    (" + driverName + " is driving" + ", " + navigatorName + " is navigating)", state.buttonText, nextStep, [state.class, "step"]);
    		curStep = newStep;
    	} // iterationEl.appendChild(newStep);

    	const buildStepElement = (title, bodyText, buttonText, buttonAction, classes) => {
    		steps.push({
    			title,
    			bodyText,
    			buttonText,
    			buttonAction,
    			classes
    		});

    		$$invalidate(0, steps);
    	};

    	const addStepToIteration = step => {
    		
    	}; //iterationEl.children.namedItem("container").appendChild(step);

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Game> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Step,
    		Iteration,
    		states,
    		players,
    		curState,
    		curDriver,
    		curNavigator,
    		stepNumber,
    		iterationCounter,
    		iterationEl,
    		curStep,
    		steps,
    		iterations,
    		startGame,
    		nextStep,
    		swapPairRoles,
    		addStep,
    		buildStepElement,
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
    		if ('iterationEl' in $$props) iterationEl = $$props.iterationEl;
    		if ('curStep' in $$props) curStep = $$props.curStep;
    		if ('steps' in $$props) $$invalidate(0, steps = $$props.steps);
    		if ('iterations' in $$props) $$invalidate(1, iterations = $$props.iterations);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [steps, iterations, startGame];
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
    	let title;
    	let t1;
    	let main;
    	let game;
    	let current;
    	game = new Game({ $$inline: true });

    	const block = {
    		c: function create() {
    			title = element("title");
    			title.textContent = "Red Green Go!";
    			t1 = space();
    			main = element("main");
    			create_component(game.$$.fragment);
    			add_location(title, file, 6, 0, 93);
    			attr_dev(main, "class", "svelte-1tky8bj");
    			add_location(main, file, 7, 0, 123);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, title, anchor);
    			insert_dev(target, t1, anchor);
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
    			if (detaching) detach_dev(title);
    			if (detaching) detach_dev(t1);
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
