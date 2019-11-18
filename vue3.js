// 双向缓存 
let toProxy = new WeakMap();  // 原始查响应后
let toRaw = new WeakMap();    // 响应后查原始

const baseHander = {
    get(target, key) {
        const res = Reflect.get(target, key)
        // 收集依赖
        tarck(target, key)
        // 递归寻找
        // 不考虑null
        return typeof res == 'object' ? reactive(res) : res
    },
    set(target, key, val) {
        const info = {oldValue: target[key], newValue:val}
        const res = Reflect.set(target, key, val)
        // 触发更新
        trigger(target, key, info)
        return res
    }
}

function reactive(target) {
    let observed = toProxy.get(target);
    // 查询缓存
    // 被响应过了
    if (observed) {
        return observed
    }
    if (toRaw.get(target)) {
        return target
    }
    observed = new Proxy(target, baseHander)
    // 设置缓存
    toProxy.set(target, observed)
    toRaw.set(observed, target)
    return observed
}

// 存储effect 
let effectStack = []  // 实际存储
let targetMap = new WeakMap();  // 作缓存用
function tarck(target, key) {
    let effect = effectStack[effectStack.length - 1]
    if (effect) {
        // 初始化
        let depsMap = targetMap.get(target)
        if (depsMap === undefined) {
            depsMap = new Map()
            targetMap.set(target, depsMap)
        }
        let dep = depsMap.get(key)
        if (dep === undefined) {
            dep = new Set()
            depsMap.set(key, dep)
        }
        // 依赖收集
        if (!dep.has(effect)) {
            dep.add(effect)
            effect.deps.push(dep)
        }
    }
}

function trigger(target, key, info) {
   // 触发更新
   const depsMap = targetMap.get(target)
   if (depsMap === undefined) {
       return
   }
   const effects = new Set()
   const computedRunners = new Set()
   if (key) {
       let deps = depsMap.get(key)
       deps.forEach(effect => {
           if (effect.computed) {
               computedRunners.add(effect)
           } else {
               effects.add(effect)
           }
       })
   }
   effects.forEach(effect => effect())
   computedRunners.forEach(effect => effect())
}

function effect(fn, options={}) {
    let e = createReactiveEffect(fn, options)
    if (!options.lazy) {  // computed逻辑
        e()
    }
    return e
}

function createReactiveEffect(fn, options) {
    const effect = function effect(...args) {
        return run(effect, fn, args)
    }
    effect.deps = []
    effect.computed = options.computed
    effect.lazy = options.lazy
    return effect
}

function run(effect, fn, args) {
    if (effectStack.indexOf(effect) === -1) {
        try{
            effectStack.push(effect)
            return fn(...args)
        }
        finally{
            effectStack.pop()
        }
    }
}
 
function computed(fn) {
    const runner = effect(fn, {computed:true, lazy:true})
    return {
        effect: runner,
        get value() {
            return runner()
        }
    }
}