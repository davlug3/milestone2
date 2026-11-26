import test from "node:test";import assert from "node:assert/strict";import {resolveCyclesPreset} from "./lib/cycles-presets.mjs";
test("cinema preserves previous defaults",()=>assert.deepEqual(resolveCyclesPreset("cinema"),{samples:96,bounces:8,noise:.02,minSamples:16,diffuse:4,glossy:4}));
test("fast settings",()=>assert.equal(resolveCyclesPreset("fast-production").samples,48));
test("overrides clamp minimum and bounces",()=>assert.deepEqual(resolveCyclesPreset("master",{samples:4,bounces:2}),{samples:4,bounces:2,noise:.005,minSamples:4,diffuse:2,glossy:2}));
test("invalid",()=>{assert.throws(()=>resolveCyclesPreset("bad"));assert.throws(()=>resolveCyclesPreset("cinema",{noise:0}));});
