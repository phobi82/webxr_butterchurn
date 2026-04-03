// Lighting domain: effects, scene lighting, projection, and presets.

// Effects

const FIXTURE_EFFECT_MODE_NONE = "soft";
const FIXTURE_EFFECT_MODE_SHUTTERS = "shutters";
const FIXTURE_EFFECT_MODE_EDGE_RUNNER = "edgeRunner";
const FIXTURE_EFFECT_MODE_SILHOUETTE = "silhouette";
const FIXTURE_EFFECT_MODE_WINDOW_BEAT = "windowBeat";
const FIXTURE_EFFECT_MODE_AURORA_CURTAIN = "auroraCurtain";
const FIXTURE_EFFECT_MODE_FLOOR_HALO = "floorHalo";
const FIXTURE_EFFECT_MODE_FLASHLIGHT = "flashlight";

const fixtureEffectDefaultAlphaBlendStrengthByType = {
	wash: 0.72,
	beam: 1.06,
	strobe: 1.42
};

const fixtureEffectDefaultModeByType = {
	wash: FIXTURE_EFFECT_MODE_SHUTTERS,
	beam: FIXTURE_EFFECT_MODE_EDGE_RUNNER,
	strobe: FIXTURE_EFFECT_MODE_WINDOW_BEAT
};

// One registry keeps mode keys, shader ids, CPU state logic, and shader branches aligned.
const fixtureEffectDefinitions = [
	{
		key: FIXTURE_EFFECT_MODE_NONE,
		shaderType: 0,
		alphaBlendStrength: 0.52,
		getState: function() {
			return {density: 0, amount: 0};
		},
		shaderLines: [
			"float radial=length(localNorm*vec2(0.86,1.06));",
			"float broad=1.0-smoothstep(0.04,1.0,radial);",
			"float core=1.0-smoothstep(0.0,0.42,radial);",
			"float plumeA=0.5+0.5*sin((localNorm.x*0.72+localNorm.y*0.18+phase)*6.28318);",
			"float plumeB=0.5+0.5*sin((localNorm.y*0.48-localNorm.x*0.12-phase*0.38)*6.28318);",
			"float cloud=smoothstep(0.18,0.9,plumeA*0.52+plumeB*0.48);",
			"float shoulder=broad*(0.42+cloud*0.26);",
			"return vec2(0.78+core*0.08+cloud*0.14,max(shoulder*(0.36+amount*0.08),core*(0.3+cloud*0.12)));"
		]
	},
	{
		key: FIXTURE_EFFECT_MODE_SHUTTERS,
		shaderType: 1,
		alphaBlendStrength: 0.56,
		getState: function(args) {
			const fillMix = args.fillMix;
			return {
				density: 1.1 + fillMix * 1.8,
				amount: fillMix
			};
		},
		shaderLines: [
			"float stripeA=0.5+0.5*sin((localNorm.x*(1.4+density*0.8)+localNorm.y*0.42+phase)*6.28318);",
			"float stripeB=0.5+0.5*sin((localNorm.x*(2.1+density*0.36)-localNorm.y*0.18+phase*1.12)*6.28318);",
			"float shutter=smoothstep(0.36,0.9,stripeA*0.64+stripeB*0.36);",
			"float envelope=1.0-smoothstep(0.16,1.02,length(localNorm*vec2(0.9,1.12)));",
			"return vec2(0.76+shutter*0.24,envelope*(0.24+shutter*(0.42+amount*0.12)));"
		]
	},
	{
		key: FIXTURE_EFFECT_MODE_EDGE_RUNNER,
		shaderType: 2,
		getState: function(args) {
			const audioMetrics = args.audioMetrics;
			const motionEnergy = audioMetrics.motionEnergy || 0;
			return {
				density: 0.8 + motionEnergy * 1.1,
				amount: clampNumber(motionEnergy * 0.7 + Math.abs(args.group.stereoBias || 0) * 0.25, 0, 1)
			};
		},
		shaderLines: [
			"float runnerCenter=sin(phase)*0.72;",
			"float runner=1.0-smoothstep(0.08,0.44,abs(localNorm.x-runnerCenter));",
			"float beamBand=1.0-smoothstep(0.1,0.48,abs(localNorm.y));",
			"float tipMask=smoothstep(0.24,0.96,abs(localNorm.x));",
			"return vec2(0.72+runner*0.28,max(beamBand*0.52,runner*tipMask*(0.82+amount*0.18)));"
		]
	},
	{
		key: FIXTURE_EFFECT_MODE_SILHOUETTE,
		shaderType: 3,
		getState: function(args) {
			const audioMetrics = args.audioMetrics;
			return {
				density: 0.9,
				amount: clampNumber((audioMetrics.transientGate || 0) * 0.8 + (audioMetrics.strobeGate || 0) * 0.4, 0, 1)
			};
		},
		shaderLines: [
			"float cut=max(abs(localNorm.x)*0.92,abs(localNorm.y)*1.16);",
			"float window=1.0-smoothstep(0.22,0.62,cut);",
			"float rim=smoothstep(0.54,0.96,length(localNorm));",
			"return vec2(0.24+rim*0.3,window*(0.86+amount*0.14));"
		]
	},
	{
		key: FIXTURE_EFFECT_MODE_WINDOW_BEAT,
		shaderType: 4,
		getState: function(args) {
			const audioMetrics = args.audioMetrics;
			return {
				density: 1.2,
				amount: clampNumber((audioMetrics.beatPulse || 0) * 0.7 + (audioMetrics.strobeGate || 0) * 0.5, 0, 1)
			};
		},
		shaderLines: [
			"float window=max(abs(localNorm.x)*0.78,abs(localNorm.y)*1.08);",
			"float beatWindow=1.0-smoothstep(0.2,0.72,window);",
			"float pulse=0.5+0.5*sin((phase+amount*0.4)*6.28318);",
			"pulse=smoothstep(0.12,0.9,pulse);",
			"return vec2(0.26+beatWindow*0.24,beatWindow*(0.46+pulse*(0.44+amount*0.1)));"
		]
	},
	{
		key: FIXTURE_EFFECT_MODE_AURORA_CURTAIN,
		shaderType: 5,
		alphaBlendStrength: 0.62,
		getState: function(args) {
			const audioMetrics = args.audioMetrics;
			const fillMix = args.fillMix;
			const colorMomentum = audioMetrics.colorMomentum || 0;
			return {
				density: 1.36 + colorMomentum * 1.24 + fillMix * 0.42,
				amount: clampNumber(0.42 + fillMix * 0.4 + colorMomentum * 0.3 + (audioMetrics.roomFill || 0) * 0.14, 0, 1)
			};
		},
		shaderLines: [
			"float bandA=0.5+0.5*sin((localNorm.x*(2.1+density*1.2)+localNorm.y*0.38+phase)*6.28318);",
			"float bandB=0.5+0.5*sin((localNorm.x*(3.2+density*0.7)-localNorm.y*0.24+phase*1.18)*6.28318);",
			"float sway=0.5+0.5*sin((localNorm.y*0.92+phase*0.7)*6.28318);",
			"bandA=smoothstep(0.58,0.92,bandA);",
			"bandB=smoothstep(0.64,0.96,bandB);",
			"sway=smoothstep(0.12,0.94,sway);",
			"float curtain=max(bandA,bandB*(0.72+amount*0.18));",
			"float aurora=curtain*(0.58+sway*0.42);",
			"return vec2(0.26+aurora*0.74,0.12+aurora*(0.72+amount*0.14));"
		]
	},
	{
		key: FIXTURE_EFFECT_MODE_FLOOR_HALO,
		shaderType: 6,
		alphaBlendStrength: 0.78,
		getState: function(args) {
			const audioMetrics = args.audioMetrics;
			return {
				density: 0.72 + (audioMetrics.bass || 0) * 0.7 + (audioMetrics.bassHit || 0) * 0.4,
				amount: clampNumber((audioMetrics.bassHit || 0) * 0.62 + (audioMetrics.kickGate || 0) * 0.26 + (audioMetrics.roomFill || 0) * 0.18, 0, 1)
			};
		},
		shaderLines: [
			"float radial=length(localNorm*vec2(0.88,1.12));",
			"float haloPulse=0.5+0.5*sin((phase+amount*0.24)*6.28318);",
			"float core=1.0-smoothstep(0.06,0.54,radial);",
			"float ring=1.0-smoothstep(0.08,0.34,abs(radial-(0.3+haloPulse*0.22)));",
			"return vec2(0.54+core*0.18+ring*0.28,max(core*(0.64+amount*0.18),ring*(0.38+amount*0.16)));"
		]
	},
	{
		key: FIXTURE_EFFECT_MODE_FLASHLIGHT,
		shaderType: 7,
		alphaBlendStrength: 0.94,
		getState: function(args) {
			const audioMetrics = args.audioMetrics;
			return {
				density: 0.22 + (audioMetrics.level || 0) * 0.2 + (audioMetrics.roomFill || 0) * 0.14,
				amount: clampNumber(0.08 + (audioMetrics.transient || 0) * 0.16 + (audioMetrics.beatPulse || 0) * 0.12, 0, 1)
			};
		},
		shaderLines: [
			"float beamRadial=length(localNorm);",
			"float beamCone=1.0-smoothstep(0.02,0.98,beamRadial);",
			"float beamSpill=1.0-smoothstep(0.08,1.04,beamRadial);",
			"float hotspot=1.0-smoothstep(0.0,0.22+density*0.22,beamRadial);",
			"float shoulder=1.0-smoothstep(0.12,0.58+density*0.12,beamRadial);",
			"return vec2(0.32+beamSpill*0.22+hotspot*0.46,beamCone*(0.22+shoulder*0.42+hotspot*(0.16+amount*0.12)));"
		]
	}
];

const getFixtureEffectDefinition = function(effectMode) {
	for (let i = 0; i < fixtureEffectDefinitions.length; i += 1) {
		if (fixtureEffectDefinitions[i].key === effectMode) {
			return fixtureEffectDefinitions[i];
		}
	}
	return fixtureEffectDefinitions[0];
};

const getDefaultFixtureEffectMode = function(type) {
	return fixtureEffectDefaultModeByType[type] || FIXTURE_EFFECT_MODE_NONE;
};

const getFixtureEffectTypeId = function(effectMode) {
	return getFixtureEffectDefinition(effectMode).shaderType;
};

const getFixtureAlphaBlendStrength = function(type, effectMode) {
	const definition = getFixtureEffectDefinition(effectMode);
	if (definition.alphaBlendStrength != null) {
		return definition.alphaBlendStrength;
	}
	return fixtureEffectDefaultAlphaBlendStrengthByType[type] || 0.94;
};

const getFixtureEffectState = function(args) {
	args = args || {};
	const group = args.group || {};
	const audioMetrics = args.audioMetrics || emptyAudioMetrics;
	const fillMix = clampNumber(args.fillMix == null ? 0 : args.fillMix, 0, 1);
	const variantCenter = clampNumber(args.variantCenter == null ? 0 : args.variantCenter, -1, 1);
	const stereoBiasOffset = clampNumber(args.stereoBiasOffset == null ? 0 : args.stereoBiasOffset, -1, 1);
	const effectMode = group.effectMode || getDefaultFixtureEffectMode(group.type);
	const definition = getFixtureEffectDefinition(effectMode);
	const effectShapeState = definition.getState({
		group: group,
		audioMetrics: audioMetrics,
		fillMix: fillMix,
		variantCenter: variantCenter,
		stereoBiasOffset: stereoBiasOffset
	});
	return {
		mode: effectMode,
		type: definition.shaderType,
		phase: (group.azimuth || 0) * 0.28 + variantCenter * 0.92 + stereoBiasOffset * 0.6,
		density: effectShapeState.density,
		amount: effectShapeState.amount,
		alphaBlendStrength: getFixtureAlphaBlendStrength(group.type, effectMode)
	};
};

// Effect definitions also own the physical footprint rules for MR projection.
const getFixtureEffectFootprint = function(args) {
	args = args || {};
	const group = args.group || {};
	const effectState = args.effectState || {mode: FIXTURE_EFFECT_MODE_NONE};
	const surfaceBudget = args.surfaceBudget || {};
	const surfaceKey = args.surfaceKey || "ceiling";
	const fillMix = clampNumber(args.fillMix == null ? 0 : args.fillMix, 0, 1);
	const surfaceDepthBool = !!args.surfaceDepthBool;
	const baseRadius = clampNumber(args.baseRadius == null ? 0.4 : args.baseRadius, 0.14, 1.6);
	let radiusX = baseRadius;
	let radiusY = baseRadius;
	if (group.type === "wash") {
		radiusX = baseRadius * (0.92 + fillMix * 0.86) * (surfaceBudget.washRadiusXScale || 1);
		radiusY = baseRadius * (surfaceKey === "wall" ? 0.82 : (surfaceKey === "floor" ? 1.08 : 0.9)) * (0.84 + fillMix * 0.68) * (surfaceBudget.washRadiusYScale || 1);
	} else if (group.type === "beam") {
		radiusX = baseRadius * (surfaceKey === "wall" ? 1.22 : 0.96) * (surfaceBudget.beamRadiusXScale || 1);
		radiusY = baseRadius * 0.24 * (surfaceBudget.beamRadiusYScale || 1);
	} else {
		radiusX = baseRadius * 0.68 * (surfaceBudget.strobeRadiusXScale || 1);
		radiusY = baseRadius * 0.42 * (surfaceBudget.strobeRadiusYScale || 1);
	}
	if (effectState.mode === FIXTURE_EFFECT_MODE_SHUTTERS) {
		radiusX *= 1.26;
		radiusY *= 0.72;
	} else if (effectState.mode === FIXTURE_EFFECT_MODE_EDGE_RUNNER) {
		radiusX *= 1.84;
		radiusY *= 0.42;
	} else if (effectState.mode === FIXTURE_EFFECT_MODE_SILHOUETTE) {
		radiusX *= 0.82;
		radiusY *= 1.62;
	} else if (effectState.mode === FIXTURE_EFFECT_MODE_WINDOW_BEAT) {
		radiusX *= 1.22;
		radiusY *= 1.08;
	} else if (effectState.mode === FIXTURE_EFFECT_MODE_AURORA_CURTAIN) {
		radiusX *= surfaceKey === "ceiling" ? 1.94 : 1.54;
		radiusY *= surfaceKey === "ceiling" ? 0.58 : 0.74;
	} else if (effectState.mode === FIXTURE_EFFECT_MODE_FLOOR_HALO) {
		radiusX *= 1.26;
		radiusY = radiusX * (surfaceKey === "floor" ? 1.02 : 0.88);
	} else if (effectState.mode === FIXTURE_EFFECT_MODE_FLASHLIGHT) {
		radiusX *= group.type === "beam" ? 1.18 : 1.04;
		radiusY = Math.max(radiusY * 1.92, radiusX * 0.72);
	} else if (effectState.mode === FIXTURE_EFFECT_MODE_NONE && group.type === "wash" && !surfaceDepthBool) {
		radiusX *= 1.08;
		radiusY *= 1.12;
	}
	return {
		radiusX: radiusX * (surfaceBudget.radiusScale || 1),
		radiusY: radiusY * (surfaceBudget.radiusScale || 1)
	};
};

const buildFixtureEffectShaderBranch = function(definition, branchIndex) {
	const branchOpen = branchIndex === 0 ? ("if(effectType<" + (definition.shaderType + 0.5).toFixed(1) + "){") : ("else if(effectType<" + (definition.shaderType + 0.5).toFixed(1) + "){");
	return [branchOpen].concat(definition.shaderLines).concat(["}"]);
};

const fixtureEffectFragmentSource = [
	"vec2 lightLayerEffect(vec2 uv, vec2 center, vec4 params, vec4 effectParams){",
	"float radiusX=max(params.x,0.0001);",
	"float radiusY=max(params.y,0.0001);",
	"float rotation=params.w;",
	"vec2 delta=uv-center;",
	"float cosAngle=cos(rotation);",
	"float sinAngle=sin(rotation);",
	"vec2 local=vec2(delta.x*cosAngle+delta.y*sinAngle,-delta.x*sinAngle+delta.y*cosAngle);",
	"vec2 localNorm=vec2(local.x/radiusX,local.y/radiusY);",
	"float effectType=effectParams.x;",
	"float phase=effectParams.y;",
	"float density=max(effectParams.z,0.0001);",
	"float amount=clamp(effectParams.w,0.0,1.0);"
].concat(
	fixtureEffectDefinitions.reduce(function(lines, definition, index) {
		return lines.concat(buildFixtureEffectShaderBranch(definition, index));
	}, [])
).concat([
	"return vec2(0.0,0.0);",
	"}"
]).join("");

// Scene lighting
const MAX_DIRECTIONAL_LIGHTS = 4;

const createEmptyLightingState = function() {
	return {
		ambientColor: new Float32Array([1, 1, 1]),
		ambientStrength: 0.3,
		lightDirections: new Float32Array(MAX_DIRECTIONAL_LIGHTS * 3),
		lightColors: new Float32Array(MAX_DIRECTIONAL_LIGHTS * 3),
		lightStrengths: new Float32Array(MAX_DIRECTIONAL_LIGHTS),
		fixtureGroups: [],
		name: "",
		description: ""
	};
};

const clearLightingState = function(state) {
	state.ambientColor[0] = 1;
	state.ambientColor[1] = 1;
	state.ambientColor[2] = 1;
	state.ambientStrength = 0.3;
	state.lightDirections.fill(0);
	state.lightColors.fill(0);
	state.lightStrengths.fill(0);
	state.fixtureGroups.length = 0;
};

const setDirectionalLight = function(state, index, direction, color, strength) {
	if (index < 0 || index >= MAX_DIRECTIONAL_LIGHTS) {
		return;
	}
	const baseOffset = index * 3;
	state.lightDirections[baseOffset] = direction.x;
	state.lightDirections[baseOffset + 1] = direction.y;
	state.lightDirections[baseOffset + 2] = direction.z;
	state.lightColors[baseOffset] = color[0];
	state.lightColors[baseOffset + 1] = color[1];
	state.lightColors[baseOffset + 2] = color[2];
	state.lightStrengths[index] = Math.max(0, strength);
};

const pushFixtureGroup = function(state, args) {
	args = args || {};
	if (!state || !state.fixtureGroups) {
		return null;
	}
	const color = args.color || [1, 1, 1];
	const group = {
		type: args.type || "wash",
		anchorType: args.anchorType || "ceiling",
		color: [clampNumber(color[0], 0, 1), clampNumber(color[1], 0, 1), clampNumber(color[2], 0, 1)],
		intensity: Math.max(0, args.intensity == null ? 0 : args.intensity),
		radius: clampNumber(args.radius == null ? 0.5 : args.radius, 0.05, 1.4),
		softness: clampNumber(args.softness == null ? 0.18 : args.softness, 0.02, 0.45),
		azimuth: args.azimuth || 0,
		sweep: clampNumber(args.sweep == null ? 0.2 : args.sweep, 0, 1.5),
		vertical: clampNumber(args.vertical == null ? 0.55 : args.vertical, 0, 1),
		pulseAmount: clampNumber(args.pulseAmount == null ? 0 : args.pulseAmount, 0, 1),
		strobeAmount: clampNumber(args.strobeAmount == null ? 0 : args.strobeAmount, 0, 1),
		stereoBias: clampNumber(args.stereoBias == null ? 0 : args.stereoBias, -1, 1),
		// Presets choose one shared effect family and passthrough resolves the rest.
		effectMode: args.effectMode || ""
	};
	state.fixtureGroups.push(group);
	return group;
};

const getRankedFixtureGroups = function(fixtureGroups) {
	const rankedGroups = (fixtureGroups || []).slice(0);
	rankedGroups.sort(function(a, b) {
		return (b.intensity || 0) - (a.intensity || 0);
	});
	return rankedGroups;
};

const getFixtureDirection = function(group) {
	const azimuth = group && group.azimuth != null ? group.azimuth : 0;
	const horizontalScale = group && group.anchorType === "wall" ? 1.05 : (group && group.anchorType === "floor" ? 0.42 : 0.72);
	const height = group && group.anchorType === "wall" ? lerpNumber(0.62, 1.02, group.vertical == null ? 0.55 : group.vertical) : (group && group.anchorType === "floor" ? 0.42 : 1.08);
	return normalizeVec3(Math.cos(azimuth) * horizontalScale, height, Math.sin(azimuth) * horizontalScale);
};

const applyFixtureGroupsToLightingState = function(state, ambientBaseStrength) {
	if (!state) {
		return;
	}
	// sort in-place — array is rebuilt each frame by the active preset
	const rankedGroups = getRankedFixtureGroups(state.fixtureGroups);
	for (let i = 0; i < MAX_DIRECTIONAL_LIGHTS; i += 1) {
		const group = rankedGroups[i];
		if (!group) {
			continue;
		}
		setDirectionalLight(state, i, getFixtureDirection(group), group.color, group.intensity);
	}
	let ambientWeight = 0;
	let ambientR = 0;
	let ambientG = 0;
	let ambientB = 0;
	let washWeight = 0;
	for (let i = 0; i < rankedGroups.length; i += 1) {
		const group = rankedGroups[i];
		const broadWashBoost = group.type === "wash" && (group.effectMode || "") === FIXTURE_EFFECT_MODE_NONE ? 1.22 : 1;
		const weight = Math.max(0, group.intensity) * (group.type === "wash" ? broadWashBoost : 0.55);
		if (weight <= 0.0001) {
			continue;
		}
		ambientWeight += weight;
		if (group.type === "wash") {
			washWeight += weight;
		}
		ambientR += group.color[0] * weight;
		ambientG += group.color[1] * weight;
		ambientB += group.color[2] * weight;
	}
	if (ambientWeight > 0.0001) {
		state.ambientColor[0] = clampNumber(ambientR / ambientWeight, 0, 1);
		state.ambientColor[1] = clampNumber(ambientG / ambientWeight, 0, 1);
		state.ambientColor[2] = clampNumber(ambientB / ambientWeight, 0, 1);
	}
	state.ambientStrength = clampNumber((ambientBaseStrength == null ? 0.18 : ambientBaseStrength) + ambientWeight * 0.05 + washWeight * 0.018, 0.08, 0.8);
	state.fixtureGroups = rankedGroups;
};

const createTopLightDirection = function(azimuth, height, ellipseX, ellipseZ) {
	return normalizeVec3(Math.cos(azimuth) * ellipseX, height, Math.sin(azimuth) * ellipseZ);
};

const getLightingUniformLocations = function(gl, program) {
	return {
		ambientColorLoc: gl.getUniformLocation(program, "ambientColor"),
		ambientStrengthLoc: gl.getUniformLocation(program, "ambientStrength"),
		lightDirectionsLoc: gl.getUniformLocation(program, "lightDirections[0]"),
		lightColorsLoc: gl.getUniformLocation(program, "lightColors[0]"),
		lightStrengthsLoc: gl.getUniformLocation(program, "lightStrengths[0]")
	};
};

const applyLightingUniforms = function(gl, uniformLocations, lightingState) {
	if (!uniformLocations || !lightingState) {
		return;
	}
	gl.uniform3fv(uniformLocations.ambientColorLoc, lightingState.ambientColor);
	gl.uniform1f(uniformLocations.ambientStrengthLoc, lightingState.ambientStrength);
	gl.uniform3fv(uniformLocations.lightDirectionsLoc, lightingState.lightDirections);
	gl.uniform3fv(uniformLocations.lightColorsLoc, lightingState.lightColors);
	gl.uniform1fv(uniformLocations.lightStrengthsLoc, lightingState.lightStrengths);
};

const getLightingPresetEffectIndex = function(presetDefinition, presetIndex) {
	return presetDefinition.effectIndex == null ? presetIndex : presetDefinition.effectIndex;
};

const createLightingPresetCatalog = function(options) {
	const presetDefinitions = options.presetDefinitions && options.presetDefinitions.length ? options.presetDefinitions : lightingPresetDefinitions;
	const presetNames = [];
	const effectIndexes = [];
	const presetIndexesByEffectIndex = {};
	for (let i = 0; i < presetDefinitions.length; i += 1) {
		const presetDefinition = presetDefinitions[i];
		const effectIndex = getLightingPresetEffectIndex(presetDefinition, i);
		presetNames.push(presetDefinition.name);
		if (effectIndexes.indexOf(effectIndex) === -1) {
			effectIndexes.push(effectIndex);
			presetIndexesByEffectIndex[effectIndex] = [];
		}
		presetIndexesByEffectIndex[effectIndex].push(i);
	}
	return {
		presetDefinitions: presetDefinitions,
		presetNames: presetNames,
		effectIndexes: effectIndexes,
		getPresetIndexForEffectVariant: function(currentPresetIndex, effectIndex, variantIndex) {
			const matchingIndexes = presetIndexesByEffectIndex[effectIndex] || [];
			if (!matchingIndexes.length) {
				return currentPresetIndex;
			}
			return matchingIndexes[(variantIndex + matchingIndexes.length) % matchingIndexes.length];
		}
	};
};

const createLightingPresetSelection = function(options) {
	options = options || {};
	const catalog = createLightingPresetCatalog(options);
	let currentPresetIndex = clampNumber(options.initialPresetIndex == null ? 0 : options.initialPresetIndex, 0, Math.max(0, catalog.presetDefinitions.length - 1));
	const getPresetDefinition = function() {
		return catalog.presetDefinitions[currentPresetIndex] || lightingPresetDefinitions[0];
	};
	const getState = function() {
		const presetDefinition = getPresetDefinition();
		return {
			presetNames: catalog.presetNames,
			currentPresetIndex: currentPresetIndex,
			currentPresetName: presetDefinition.name || "",
			currentPresetDescription: presetDefinition.description || "",
			currentPresetEffectName: presetDefinition.effectName || presetDefinition.name || "",
			currentPresetEffectDescription: presetDefinition.effectDescription || presetDefinition.description || "",
			currentPresetEffectIndex: getLightingPresetEffectIndex(presetDefinition, currentPresetIndex),
			currentPresetEffectCount: presetDefinition.effectCount == null ? catalog.presetDefinitions.length : presetDefinition.effectCount,
			currentPresetVariantKey: presetDefinition.variantKey || "",
			currentPresetVariantIndex: presetDefinition.variantIndex == null ? 0 : presetDefinition.variantIndex,
			currentPresetVariantCount: presetDefinition.variantCount == null ? 1 : presetDefinition.variantCount,
			currentPresetVariantLabel: presetDefinition.variantLabel || "",
			currentPresetSurfaceKey: presetDefinition.surfaceKey || ""
		};
	};
	const selectPreset = function(index) {
		const presetDefinitions = catalog.presetDefinitions;
		if (!presetDefinitions.length) {
			return;
		}
		currentPresetIndex = (index + presetDefinitions.length) % presetDefinitions.length;
	};
	const cycleEffect = function(direction) {
		const effectIndexes = catalog.effectIndexes;
		const presetDefinition = getPresetDefinition();
		const currentEffectIndex = getLightingPresetEffectIndex(presetDefinition, currentPresetIndex);
		const effectPosition = effectIndexes.indexOf(currentEffectIndex);
		const safeEffectPosition = effectPosition >= 0 ? effectPosition : 0;
		const nextEffectIndex = effectIndexes[(safeEffectPosition + (direction < 0 ? -1 : 1) + effectIndexes.length) % effectIndexes.length];
		currentPresetIndex = catalog.getPresetIndexForEffectVariant(currentPresetIndex, nextEffectIndex, presetDefinition.variantIndex || 0);
	};
	const cycleVariant = function(direction) {
		const presetDefinition = getPresetDefinition();
		const variantCount = presetDefinition.variantCount == null ? 1 : presetDefinition.variantCount;
		if (variantCount <= 1) {
			return;
		}
		const effectIndex = getLightingPresetEffectIndex(presetDefinition, currentPresetIndex);
		const nextVariantIndex = ((presetDefinition.variantIndex || 0) + (direction < 0 ? -1 : 1) + variantCount) % variantCount;
		currentPresetIndex = catalog.getPresetIndexForEffectVariant(currentPresetIndex, effectIndex, nextVariantIndex);
	};
	return {
		getPresetDefinition: getPresetDefinition,
		getState: getState,
		selectPreset: selectPreset,
		cycleEffect: cycleEffect,
		cycleVariant: cycleVariant
	};
};

const resolvedSceneLightingActionPromise = Promise.resolve();

const createSceneLighting = function(options) {
	const selection = createLightingPresetSelection(options || {});
	const lightingState = createEmptyLightingState();
	return {
		lightingState: lightingState,
		update: function(timeSeconds, audioMetrics) {
			const presetDefinition = selection.getPresetDefinition();
			clearLightingState(lightingState);
			presetDefinition.buildState(lightingState, timeSeconds || 0, audioMetrics || {});
			lightingState.name = presetDefinition.name;
			lightingState.description = presetDefinition.description;
			return lightingState;
		},
		getState: function() {
			return lightingState;
		},
		getSelectionState: function() {
			return selection.getState();
		},
		selectPreset: function(index) {
			selection.selectPreset(index);
			return resolvedSceneLightingActionPromise;
		},
		cycleEffect: function(direction) {
			selection.cycleEffect(direction);
			return resolvedSceneLightingActionPromise;
		},
		cycleVariant: function(direction) {
			selection.cycleVariant(direction);
			return resolvedSceneLightingActionPromise;
		}
	};
};


// MR projection

const PASSTHROUGH_MAX_FLASHLIGHTS = 2;
const PASSTHROUGH_MAX_LIGHT_LAYERS = 24;
const PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT = 2.6;
const PASSTHROUGH_ROOM_LIGHT_MIN_DISTANCE = 2.4;
const PASSTHROUGH_ROOM_LIGHT_MAX_DISTANCE = 5.6;
const PASSTHROUGH_ROOM_HALF_WIDTH = 3.6;
const PASSTHROUGH_ROOM_HALF_DEPTH = 4.4;
const PASSTHROUGH_ROOM_FLOOR_Y = 0.08;
const PASSTHROUGH_ROOM_WALL_MIN_Y = PASSTHROUGH_ROOM_FLOOR_Y + 0.42;
const PASSTHROUGH_ROOM_WALL_MAX_Y = PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT - 0.34;
const PASSTHROUGH_MIN_WORLD_RADIUS_METERS = 0.12;
const PASSTHROUGH_MAX_WORLD_RADIUS_METERS = 3.2;

const PASSTHROUGH_LIGHTING_ANCHOR_MODE_AUTO = "auto";
const PASSTHROUGH_LIGHTING_ANCHOR_MODE_VR_WORLD = "vrWorld";
const PASSTHROUGH_LIGHTING_ANCHOR_MODE_REAL_WORLD = "realWorld";

const createProjectedLightLayerBuffer = function() {
	return {
		count: 0,
		surfaceDepthLayerCount: 0,
		centersUv: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 2),
		colors: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 4),
		ellipseParamsUv: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 4),
		alphaBlendStrengths: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS),
		effectParams: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 4),
		worldCenters: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 3),
		worldBasisX: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 3),
		worldBasisY: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 3),
		worldEllipseParams: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS * 4),
		surfaceDepthFlags: new Float32Array(PASSTHROUGH_MAX_LIGHT_LAYERS)
	};
};

const getProjectedLightLayerBuffer = function(controllerState) {
	if (!controllerState || !controllerState.projectedLightLayerBuffer) {
		if (controllerState) {
			controllerState.projectedLightLayerBuffer = createProjectedLightLayerBuffer();
		}
		return controllerState && controllerState.projectedLightLayerBuffer ? controllerState.projectedLightLayerBuffer : createProjectedLightLayerBuffer();
	}
	return controllerState.projectedLightLayerBuffer;
};

const resetProjectedLightLayerBuffer = function(buffer) {
	if (!buffer) {
		return;
	}
	buffer.count = 0;
	buffer.surfaceDepthLayerCount = 0;
};

const projectWorldPointToUv = function(viewMatrix, projMatrix, x, y, z) {
	const viewX = viewMatrix[0] * x + viewMatrix[4] * y + viewMatrix[8] * z + viewMatrix[12];
	const viewY = viewMatrix[1] * x + viewMatrix[5] * y + viewMatrix[9] * z + viewMatrix[13];
	const viewZ = viewMatrix[2] * x + viewMatrix[6] * y + viewMatrix[10] * z + viewMatrix[14];
	const clipX = projMatrix[0] * viewX + projMatrix[4] * viewY + projMatrix[8] * viewZ + projMatrix[12];
	const clipY = projMatrix[1] * viewX + projMatrix[5] * viewY + projMatrix[9] * viewZ + projMatrix[13];
	const clipW = projMatrix[3] * viewX + projMatrix[7] * viewY + projMatrix[11] * viewZ + projMatrix[15];
	if (clipW <= 0.0001) {
		return null;
	}
	const ndcX = clipX / clipW;
	const ndcY = clipY / clipW;
	if (Math.abs(ndcX) > 1.2 || Math.abs(ndcY) > 1.2) {
		return null;
	}
	return {
		x: clampNumber(ndcX * 0.5 + 0.5, 0, 1),
		y: clampNumber(ndcY * 0.5 + 0.5, 0, 1)
	};
};

const transformPointByMatrix = function(matrix, point) {
	return {
		x: matrix[0] * point.x + matrix[4] * point.y + matrix[8] * point.z + matrix[12],
		y: matrix[1] * point.x + matrix[5] * point.y + matrix[9] * point.z + matrix[13],
		z: matrix[2] * point.x + matrix[6] * point.y + matrix[10] * point.z + matrix[14]
	};
};

const getPointDistance2d = function(ax, ay, bx, by) {
	const deltaX = bx - ax;
	const deltaY = by - ay;
	return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
};

const getPointDistance3d = function(a, b) {
	if (!a || !b) {
		return 0;
	}
	const deltaX = b.x - a.x;
	const deltaY = b.y - a.y;
	const deltaZ = b.z - a.z;
	return Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
};

const crossVec3 = function(ax, ay, az, bx, by, bz) {
	return {
		x: ay * bz - az * by,
		y: az * bx - ax * bz,
		z: ax * by - ay * bx
	};
};

const getAveragedLightingColor = function(lightingState) {
	if (!lightingState) {
		return [1, 1, 1];
	}
	let totalWeight = Math.max(0.0001, lightingState.ambientStrength * 0.75);
	let colorR = lightingState.ambientColor[0] * lightingState.ambientStrength * 0.75;
	let colorG = lightingState.ambientColor[1] * lightingState.ambientStrength * 0.75;
	let colorB = lightingState.ambientColor[2] * lightingState.ambientStrength * 0.75;
	for (let i = 0; i < lightingState.lightStrengths.length; i += 1) {
		const strength = Math.max(0, lightingState.lightStrengths[i] || 0);
		if (strength <= 0.0001) {
			continue;
		}
		const colorOffset = i * 3;
		colorR += lightingState.lightColors[colorOffset] * strength;
		colorG += lightingState.lightColors[colorOffset + 1] * strength;
		colorB += lightingState.lightColors[colorOffset + 2] * strength;
		totalWeight += strength;
	}
	return [
		clampNumber(colorR / totalWeight, 0, 1),
		clampNumber(colorG / totalWeight, 0, 1),
		clampNumber(colorB / totalWeight, 0, 1)
	];
};

const getRoomCeilingLightPoint = function(directionX, directionY, directionZ) {
	if (directionY <= 0.05) {
		return null;
	}
	const roomDistance = clampNumber(
		PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT / directionY,
		PASSTHROUGH_ROOM_LIGHT_MIN_DISTANCE,
		PASSTHROUGH_ROOM_LIGHT_MAX_DISTANCE
	);
	return {
		x: clampNumber(directionX * roomDistance, -PASSTHROUGH_ROOM_HALF_WIDTH, PASSTHROUGH_ROOM_HALF_WIDTH),
		y: PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT,
		z: clampNumber(directionZ * roomDistance, -PASSTHROUGH_ROOM_HALF_DEPTH, PASSTHROUGH_ROOM_HALF_DEPTH)
	};
};

const getRoomFloorLightPoint = function(ceilingPoint) {
	if (!ceilingPoint) {
		return null;
	}
	return {
		x: ceilingPoint.x,
		y: PASSTHROUGH_ROOM_FLOOR_Y,
		z: ceilingPoint.z
	};
};

const getRoomWallLightY = function(vertical) {
	return lerpNumber(
		PASSTHROUGH_ROOM_WALL_MIN_Y,
		PASSTHROUGH_ROOM_WALL_MAX_Y,
		clampNumber(vertical == null ? 0.55 : vertical, 0, 1)
	);
};

const getRoomWallLightPoint = function(ceilingPoint, vertical) {
	if (!ceilingPoint) {
		return null;
	}
	const absX = Math.abs(ceilingPoint.x);
	const absZ = Math.abs(ceilingPoint.z);
	if (absX <= 0.05 && absZ <= 0.05) {
		return null;
	}
	const scaleToWall = absX > absZ ? PASSTHROUGH_ROOM_HALF_WIDTH / Math.max(absX, 0.0001) : PASSTHROUGH_ROOM_HALF_DEPTH / Math.max(absZ, 0.0001);
	return {
		x: clampNumber(ceilingPoint.x * scaleToWall, -PASSTHROUGH_ROOM_HALF_WIDTH, PASSTHROUGH_ROOM_HALF_WIDTH),
		y: getRoomWallLightY(vertical),
		z: clampNumber(ceilingPoint.z * scaleToWall, -PASSTHROUGH_ROOM_HALF_DEPTH, PASSTHROUGH_ROOM_HALF_DEPTH)
	};
};

const getFixtureSurfaceKey = function(anchorType) {
	if (anchorType === "floor") {
		return "floor";
	}
	if (anchorType === "wall") {
		return "wall";
	}
	return "ceiling";
};

const getClubSurfaceBudget = function(surfaceKey, audioMetrics) {
	audioMetrics = audioMetrics || emptyAudioMetrics;
	const fillMix = clampNumber((audioMetrics.roomFill || 0) * 0.82 + (audioMetrics.bass || 0) * 0.12, 0, 1);
	const clubIntensity = clampNumber((audioMetrics.level || 0) * 0.4 + (audioMetrics.beatPulse || 0) * 0.3 + 0.3, 0.3, 1);
	if (surfaceKey === "floor") {
		return {
			strengthScale: 1.12 + fillMix * 0.22 + (audioMetrics.bass || 0) * 0.14 + (audioMetrics.bassHit || 0) * 0.26 + (audioMetrics.kickGate || 0) * 0.16,
			minimumStrength: 0.14 + clubIntensity * 0.12 + fillMix * 0.1 + (audioMetrics.roomFill || 0) * 0.08,
			radiusScale: 1.32 + fillMix * 0.12 + (audioMetrics.bass || 0) * 0.14,
			softnessBias: 0.05,
			radialScale: 0.66,
			depthScale: 0.48,
			washVariantCountBoost: 2,
			beamVariantCountBoost: 1,
			strobeVariantCountBoost: 1,
			washRadiusXScale: 1.24,
			washRadiusYScale: 1.62,
			beamRadiusXScale: 1,
			beamRadiusYScale: 1,
			strobeRadiusXScale: 1.04,
			strobeRadiusYScale: 1.12
		};
	}
	if (surfaceKey === "wall") {
		return {
			strengthScale: 0.92 + (1 - fillMix) * 0.08 + (audioMetrics.stereoWidth || 0) * 0.12 + (audioMetrics.transient || 0) * 0.08,
			minimumStrength: 0.05 + (audioMetrics.stereoWidth || 0) * 0.04,
			radiusScale: 0.98,
			softnessBias: -0.01,
			radialScale: 1,
			depthScale: 1,
			washVariantCountBoost: 0,
			beamVariantCountBoost: 0,
			strobeVariantCountBoost: 0,
			washRadiusXScale: 0.92,
			washRadiusYScale: 0.84,
			beamRadiusXScale: 1.58,
			beamRadiusYScale: 0.56,
			strobeRadiusXScale: 0.94,
			strobeRadiusYScale: 0.88
		};
	}
	return {
		strengthScale: 0.92 + fillMix * 0.18 + (audioMetrics.roomFill || 0) * 0.12,
		minimumStrength: 0.05 + fillMix * 0.04,
		radiusScale: 1.12 + fillMix * 0.08,
		softnessBias: 0.05,
		radialScale: 0.98,
		depthScale: 0.96,
		washVariantCountBoost: 1,
		beamVariantCountBoost: 0,
		strobeVariantCountBoost: 0,
		washRadiusXScale: 1.36,
		washRadiusYScale: 1.22,
		beamRadiusXScale: 0.96,
		beamRadiusYScale: 1.04,
		strobeRadiusXScale: 1,
		strobeRadiusYScale: 1
	};
};

const getRoomPointForFixtureGroup = function(group, variantOffset, fillMix, surfaceBudget, stereoBiasOffset) {
	group = group || {};
	const anchorType = group.anchorType || "ceiling";
	const azimuth = (group.azimuth || 0) + variantOffset + (stereoBiasOffset || 0);
	surfaceBudget = surfaceBudget || getClubSurfaceBudget(getFixtureSurfaceKey(anchorType), emptyAudioMetrics);
	const radialScale = clampNumber((group.radius == null ? 0.5 : group.radius) * (0.58 + fillMix * 0.42) * surfaceBudget.radialScale, 0.18, 1.18);
	if (anchorType === "ceiling") {
		return {
			x: Math.cos(azimuth) * PASSTHROUGH_ROOM_HALF_WIDTH * radialScale,
			y: PASSTHROUGH_ROOM_LIGHT_CEILING_HEIGHT,
			z: Math.sin(azimuth) * PASSTHROUGH_ROOM_HALF_DEPTH * radialScale * surfaceBudget.depthScale
		};
	}
	if (anchorType === "floor") {
		return {
			x: Math.cos(azimuth) * PASSTHROUGH_ROOM_HALF_WIDTH * radialScale,
			y: PASSTHROUGH_ROOM_FLOOR_Y,
			z: Math.sin(azimuth) * PASSTHROUGH_ROOM_HALF_DEPTH * radialScale * surfaceBudget.depthScale
		};
	}
	if (Math.abs(group.stereoBias || 0) > 0.1) {
		const trackDepth = Math.sin(azimuth) * PASSTHROUGH_ROOM_HALF_DEPTH * radialScale * surfaceBudget.depthScale;
		const depthSign = trackDepth < 0 ? -1 : 1;
		const depthLane = 0.26 + Math.abs(trackDepth / Math.max(PASSTHROUGH_ROOM_HALF_DEPTH, 0.0001)) * 0.74;
		return {
			x: PASSTHROUGH_ROOM_HALF_WIDTH * (group.stereoBias < 0 ? -1 : 1),
			y: getRoomWallLightY(group.vertical),
			z: clampNumber(depthSign * PASSTHROUGH_ROOM_HALF_DEPTH * depthLane, -PASSTHROUGH_ROOM_HALF_DEPTH, PASSTHROUGH_ROOM_HALF_DEPTH)
		};
	}
	const wallScaleX = PASSTHROUGH_ROOM_HALF_WIDTH / Math.max(Math.abs(Math.cos(azimuth)), 0.0001);
	const wallScaleZ = PASSTHROUGH_ROOM_HALF_DEPTH / Math.max(Math.abs(Math.sin(azimuth)), 0.0001);
	const wallScale = Math.min(wallScaleX, wallScaleZ) * radialScale;
	return {
		x: clampNumber(Math.cos(azimuth) * wallScale, -PASSTHROUGH_ROOM_HALF_WIDTH, PASSTHROUGH_ROOM_HALF_WIDTH),
		y: getRoomWallLightY(group.vertical),
		z: clampNumber(Math.sin(azimuth) * wallScale, -PASSTHROUGH_ROOM_HALF_DEPTH, PASSTHROUGH_ROOM_HALF_DEPTH)
	};
};

const getEffectiveLightingAnchorModeKey = function(controllerState) {
	const requestedModeKey = controllerState && controllerState.lightingAnchorModeKey ? controllerState.lightingAnchorModeKey : PASSTHROUGH_LIGHTING_ANCHOR_MODE_AUTO;
	if (requestedModeKey === PASSTHROUGH_LIGHTING_ANCHOR_MODE_AUTO) {
		const depthActiveBool = !!(controllerState && controllerState.depthActiveBool);
		const usableDepthBool = !!(controllerState && controllerState.usableDepthAvailableBool);
		return depthActiveBool && usableDepthBool ? PASSTHROUGH_LIGHTING_ANCHOR_MODE_REAL_WORLD : PASSTHROUGH_LIGHTING_ANCHOR_MODE_VR_WORLD;
	}
	return requestedModeKey;
};

const canUseSurfaceDepth = function(controllerState) {
	return !!(
		controllerState &&
		controllerState.depthActiveBool &&
		controllerState.usableDepthAvailableBool
	);
};

const getRealWorldRoomOrigin = function(controllerState, args) {
	if (!controllerState) {
		return {x: 0, y: 0, z: 0};
	}
	if (!controllerState.lightingRealWorldRoomOrigin) {
		const cameraPosition = args && args.viewMatrix ? extractCameraPositionFromViewMatrix(args.viewMatrix) : {x: 0, y: 0, z: 0};
		controllerState.lightingRealWorldRoomOrigin = {
			x: cameraPosition.x,
			y: 0,
			z: cameraPosition.z
		};
	}
	return controllerState.lightingRealWorldRoomOrigin;
};

const getRealWorldRoomPoint = function(point, controllerState, args) {
	if (!point) {
		return null;
	}
	const origin = getRealWorldRoomOrigin(controllerState, args);
	return {
		x: origin.x + point.x,
		y: point.y,
		z: origin.z + point.z
	};
};

const getAnchoredRoomPoint = function(args, point, controllerState) {
	if (!point) {
		return null;
	}
	const effectiveModeKey = getEffectiveLightingAnchorModeKey(controllerState);
	if (effectiveModeKey === PASSTHROUGH_LIGHTING_ANCHOR_MODE_REAL_WORLD) {
		return getRealWorldRoomPoint(point, controllerState, args);
	}
	if (effectiveModeKey !== PASSTHROUGH_LIGHTING_ANCHOR_MODE_VR_WORLD || !args || !args.renderViewMatrix || !args.viewMatrix) {
		return point;
	}
	return transformPointByMatrix(
		multiplyMatrices(buildWorldFromViewMatrix(args.viewMatrix), args.renderViewMatrix),
		point
	);
};

const getRoomSurfaceFrame = function(point, anchorType) {
	if (!point) {
		return null;
	}
	let normal = null;
	let tangentX = null;
	let tangentY = null;
	if (anchorType === "floor" || anchorType === "ceiling") {
		const radialLength = Math.sqrt(point.x * point.x + point.z * point.z);
		const radial = radialLength > 0.001 ? normalizeVec3(point.x, 0, point.z) : {x: 1, y: 0, z: 0};
		normal = anchorType === "floor" ? {x: 0, y: 1, z: 0} : {x: 0, y: -1, z: 0};
		tangentX = normalizeVec3(-radial.z, 0, radial.x);
		if (Math.abs(tangentX.x) < 0.001 && Math.abs(tangentX.z) < 0.001) {
			tangentX = {x: 1, y: 0, z: 0};
		}
		const tangentYCross = crossVec3(normal.x, normal.y, normal.z, tangentX.x, tangentX.y, tangentX.z);
		tangentY = normalizeVec3(tangentYCross.x, tangentYCross.y, tangentYCross.z);
		return {
			normal: normal,
			tangentX: tangentX,
			tangentY: tangentY
		};
	}
	if (Math.abs(Math.abs(point.x) - PASSTHROUGH_ROOM_HALF_WIDTH) <= Math.abs(Math.abs(point.z) - PASSTHROUGH_ROOM_HALF_DEPTH)) {
		normal = {x: point.x >= 0 ? -1 : 1, y: 0, z: 0};
		tangentX = {x: 0, y: 0, z: point.x >= 0 ? -1 : 1};
	} else {
		normal = {x: 0, y: 0, z: point.z >= 0 ? -1 : 1};
		tangentX = {x: point.z >= 0 ? 1 : -1, y: 0, z: 0};
	}
	tangentY = {x: 0, y: 1, z: 0};
	return {
		normal: normal,
		tangentX: tangentX,
		tangentY: tangentY
	};
};

const getAnchoredRoomFrame = function(args, roomPoint, roomFrame, controllerState) {
	if (!roomPoint || !roomFrame) {
		return null;
	}
	const centerPoint = getAnchoredRoomPoint(args, roomPoint, controllerState);
	const tangentPointX = getAnchoredRoomPoint(args, {
		x: roomPoint.x + roomFrame.tangentX.x,
		y: roomPoint.y + roomFrame.tangentX.y,
		z: roomPoint.z + roomFrame.tangentX.z
	}, controllerState);
	const tangentPointY = getAnchoredRoomPoint(args, {
		x: roomPoint.x + roomFrame.tangentY.x,
		y: roomPoint.y + roomFrame.tangentY.y,
		z: roomPoint.z + roomFrame.tangentY.z
	}, controllerState);
	if (!centerPoint || !tangentPointX || !tangentPointY) {
		return null;
	}
	return {
		centerPoint: centerPoint,
		tangentX: normalizeVec3(
			tangentPointX.x - centerPoint.x,
			tangentPointX.y - centerPoint.y,
			tangentPointX.z - centerPoint.z
		),
		tangentY: normalizeVec3(
			tangentPointY.x - centerPoint.x,
			tangentPointY.y - centerPoint.y,
			tangentPointY.z - centerPoint.z
		)
	};
};

const getProjectedMaskFromWorldFootprint = function(args, centerPoint, tangentX, tangentY, radiusX, radiusY) {
	if (!args || !args.viewMatrix || !args.projMatrix || !centerPoint || !tangentX || !tangentY) {
		return null;
	}
	const centerUv = projectWorldPointToUv(args.viewMatrix, args.projMatrix, centerPoint.x, centerPoint.y, centerPoint.z);
	if (!centerUv) {
		return null;
	}
	const radiusPointX = {
		x: centerPoint.x + tangentX.x * radiusX,
		y: centerPoint.y + tangentX.y * radiusX,
		z: centerPoint.z + tangentX.z * radiusX
	};
	const radiusPointY = {
		x: centerPoint.x + tangentY.x * radiusY,
		y: centerPoint.y + tangentY.y * radiusY,
		z: centerPoint.z + tangentY.z * radiusY
	};
	const projectedRadiusUvX = projectWorldPointToUv(args.viewMatrix, args.projMatrix, radiusPointX.x, radiusPointX.y, radiusPointX.z);
	const projectedRadiusUvY = projectWorldPointToUv(args.viewMatrix, args.projMatrix, radiusPointY.x, radiusPointY.y, radiusPointY.z);
	if (!projectedRadiusUvX || !projectedRadiusUvY) {
		return null;
	}
	return {
		x: centerUv.x,
		y: centerUv.y,
		rotation: Math.atan2(projectedRadiusUvX.y - centerUv.y, projectedRadiusUvX.x - centerUv.x),
		radiusX: clampNumber(getPointDistance2d(centerUv.x, centerUv.y, projectedRadiusUvX.x, projectedRadiusUvX.y), 0.02, 0.5),
		radiusY: clampNumber(getPointDistance2d(centerUv.x, centerUv.y, projectedRadiusUvY.x, projectedRadiusUvY.y), 0.02, 0.48)
	};
};

const getFixtureWorldRadii = function(group, effectState, fillMix, surfaceBudget, surfaceKey, surfaceDepthBool) {
	const footprint = getFixtureEffectFootprint({
		group: group,
		effectState: effectState,
		fillMix: fillMix,
		surfaceBudget: surfaceBudget,
		surfaceKey: surfaceKey,
		surfaceDepthBool: surfaceDepthBool,
		baseRadius: group && group.radius
	});
	return {
		radiusX: clampNumber(footprint.radiusX, PASSTHROUGH_MIN_WORLD_RADIUS_METERS, PASSTHROUGH_MAX_WORLD_RADIUS_METERS),
		radiusY: clampNumber(footprint.radiusY, PASSTHROUGH_MIN_WORLD_RADIUS_METERS * 0.6, PASSTHROUGH_MAX_WORLD_RADIUS_METERS)
	};
};

const shouldUseSurfaceDepth = function(controllerState, args) {
	return getEffectiveLightingAnchorModeKey(controllerState) === PASSTHROUGH_LIGHTING_ANCHOR_MODE_REAL_WORLD && canUseSurfaceDepth(controllerState);
};

const getSurfaceProjectionState = function(args, controllerState, roomPoint, anchorType, radiusX, radiusY) {
	const roomFrame = getRoomSurfaceFrame(roomPoint, anchorType);
	const anchoredFrame = getAnchoredRoomFrame(args, roomPoint, roomFrame, controllerState);
	if (!anchoredFrame) {
		return null;
	}
	const maskState = getProjectedMaskFromWorldFootprint(
		args,
		anchoredFrame.centerPoint,
		anchoredFrame.tangentX,
		anchoredFrame.tangentY,
		radiusX,
		radiusY
	);
	if (!maskState) {
		return null;
	}
	return {
		maskState: maskState,
		centerPoint: anchoredFrame.centerPoint,
		tangentX: anchoredFrame.tangentX,
		tangentY: anchoredFrame.tangentY,
		radiusX: radiusX,
		radiusY: radiusY,
		surfaceDepthBool: shouldUseSurfaceDepth(controllerState, args)
	};
};

const appendProjectedLightLayer = function(buffer, layerState) {
	if (!buffer || !layerState || buffer.count >= PASSTHROUGH_MAX_LIGHT_LAYERS) {
		return false;
	}
	const layerIndex = buffer.count;
	const centerOffset = layerIndex * 2;
	const colorOffset = layerIndex * 4;
	const ellipseOffset = layerIndex * 4;
	const worldCenterOffset = layerIndex * 3;
	const worldBasisOffset = layerIndex * 3;
	const worldParamsOffset = layerIndex * 4;
	buffer.centersUv[centerOffset] = layerState.centerUvX || 0;
	buffer.centersUv[centerOffset + 1] = layerState.centerUvY || 0;
	buffer.colors[colorOffset] = layerState.colorR || 0;
	buffer.colors[colorOffset + 1] = layerState.colorG || 0;
	buffer.colors[colorOffset + 2] = layerState.colorB || 0;
	buffer.colors[colorOffset + 3] = layerState.strength || 0;
	buffer.ellipseParamsUv[ellipseOffset] = layerState.radiusUvX || 0;
	buffer.ellipseParamsUv[ellipseOffset + 1] = layerState.radiusUvY || 0;
	buffer.ellipseParamsUv[ellipseOffset + 2] = layerState.softnessUv || 0;
	buffer.ellipseParamsUv[ellipseOffset + 3] = layerState.rotation || 0;
	buffer.alphaBlendStrengths[layerIndex] = layerState.alphaBlendStrength == null ? 1 : layerState.alphaBlendStrength;
	buffer.effectParams[ellipseOffset] = layerState.effectType || 0;
	buffer.effectParams[ellipseOffset + 1] = layerState.effectPhase || 0;
	buffer.effectParams[ellipseOffset + 2] = layerState.effectDensity || 0;
	buffer.effectParams[ellipseOffset + 3] = layerState.effectAmount || 0;
	buffer.worldCenters[worldCenterOffset] = layerState.worldCenterX || 0;
	buffer.worldCenters[worldCenterOffset + 1] = layerState.worldCenterY || 0;
	buffer.worldCenters[worldCenterOffset + 2] = layerState.worldCenterZ || 0;
	buffer.worldBasisX[worldBasisOffset] = layerState.worldBasisXX || 0;
	buffer.worldBasisX[worldBasisOffset + 1] = layerState.worldBasisXY || 0;
	buffer.worldBasisX[worldBasisOffset + 2] = layerState.worldBasisXZ || 0;
	buffer.worldBasisY[worldBasisOffset] = layerState.worldBasisYX || 0;
	buffer.worldBasisY[worldBasisOffset + 1] = layerState.worldBasisYY || 0;
	buffer.worldBasisY[worldBasisOffset + 2] = layerState.worldBasisYZ || 0;
	buffer.worldEllipseParams[worldParamsOffset] = layerState.worldRadiusX || 0;
	buffer.worldEllipseParams[worldParamsOffset + 1] = layerState.worldRadiusY || 0;
	buffer.worldEllipseParams[worldParamsOffset + 2] = layerState.worldSoftness || 0;
	buffer.worldEllipseParams[worldParamsOffset + 3] = layerState.worldPlaneWidth || 0;
	buffer.surfaceDepthFlags[layerIndex] = layerState.surfaceDepthBool ? 1 : 0;
	buffer.count += 1;
	if (layerState.surfaceDepthBool) {
		buffer.surfaceDepthLayerCount += 1;
	}
	return true;
};

const appendControllerFlashlightLayers = function(buffer, args, group, fillMix, baseStrength, typeIntensityScale, strobeBoost) {
	const controllerRays = args.controllerRays || [];
	for (let i = 0; i < controllerRays.length && buffer && buffer.count < PASSTHROUGH_MAX_LIGHT_LAYERS; i += 1) {
		const ray = controllerRays[i];
		if (!ray || !ray.origin || !ray.dir) {
			continue;
		}
		const point = ray.hitPoint || {
			x: ray.origin.x + ray.dir.x * 6,
			y: ray.origin.y + ray.dir.y * 6,
			z: ray.origin.z + ray.dir.z * 6
		};
		let tangentX = crossVec3(0, 1, 0, ray.dir.x, ray.dir.y, ray.dir.z);
		if (getPointDistance3d({x: 0, y: 0, z: 0}, tangentX) <= 0.01) {
			tangentX = crossVec3(1, 0, 0, ray.dir.x, ray.dir.y, ray.dir.z);
		}
		tangentX = normalizeVec3(tangentX.x, tangentX.y, tangentX.z);
		let tangentY = crossVec3(ray.dir.x, ray.dir.y, ray.dir.z, tangentX.x, tangentX.y, tangentX.z);
		tangentY = normalizeVec3(tangentY.x, tangentY.y, tangentY.z);
		const effectState = getFixtureEffectState({
			group: group,
			audioMetrics: args.audioMetrics,
			fillMix: fillMix,
			variantCenter: 0,
			stereoBiasOffset: 0
		});
		const baseRadius = clampNumber((group.radius || 0.4) * (group.type === "wash" ? 0.82 : 0.62), 0.22, 1.2);
		const maskState = getProjectedMaskFromWorldFootprint(args, point, tangentX, tangentY, baseRadius * 1.18, baseRadius * 0.84);
		if (!maskState) {
			continue;
		}
		appendProjectedLightLayer(buffer, {
			centerUvX: maskState.x,
			centerUvY: maskState.y,
			colorR: group.color[0],
			colorG: group.color[1],
			colorB: group.color[2],
			radiusUvX: maskState.radiusX,
			radiusUvY: maskState.radiusY,
			rotation: maskState.rotation,
			softnessUv: clampNumber((group.softness == null ? 0.16 : group.softness), 0.04, 0.4),
			alphaBlendStrength: effectState.alphaBlendStrength,
			effectType: effectState.type,
			effectPhase: effectState.phase,
			effectDensity: effectState.density,
			effectAmount: effectState.amount,
			worldCenterX: point.x,
			worldCenterY: point.y,
			worldCenterZ: point.z,
			worldBasisXX: tangentX.x,
			worldBasisXY: tangentX.y,
			worldBasisXZ: tangentX.z,
			worldBasisYX: tangentY.x,
			worldBasisYY: tangentY.y,
			worldBasisYZ: tangentY.z,
			worldRadiusX: baseRadius * 1.18,
			worldRadiusY: baseRadius * 0.84,
			worldSoftness: clampNumber(baseRadius * 0.2, 0.05, 0.28),
			worldPlaneWidth: clampNumber(baseRadius * 0.3, 0.08, 0.34),
			surfaceDepthBool: false,
			strength: clampNumber(baseStrength * typeIntensityScale * strobeBoost, 0, group.type === "strobe" ? 0.88 : 0.72)
		});
	}
};

const appendClubFixtureLayers = function(buffer, args, group, clubState) {
	if (!buffer || !group || !args || !args.viewMatrix || !args.projMatrix) {
		return;
	}
	const surfaceKey = getFixtureSurfaceKey(group.anchorType);
	const surfaceBudget = getClubSurfaceBudget(surfaceKey, args.audioMetrics);
	const fillMix = clampNumber((args.audioMetrics && args.audioMetrics.roomFill || 0) * 0.8 + (group.type === "wash" ? 0.2 : 0), 0.18, 1);
	const stereoBiasOffset = clampNumber(((group.stereoBias || 0) * ((args.audioMetrics && args.audioMetrics.stereoBalance) || 0)) * 0.34, -0.34, 0.34);
	const sweep = clampNumber(group.sweep == null ? 0.2 : group.sweep, 0, 1.5);
	const baseStrength = Math.max(0, group.intensity || 0);
	if (baseStrength <= 0.0001) {
		return;
	}
	const strobeBoost = 1 + clampNumber((group.strobeAmount || 0) * 0.55, 0, 0.55);
	const typeIntensityScale = group.type === "wash" ? (0.78 + fillMix * 0.24) : (group.type === "beam" ? (0.92 - fillMix * 0.08) : 0.92);
	if ((group.effectMode || "") === FIXTURE_EFFECT_MODE_FLASHLIGHT && (args.controllerRays || []).length > 0) {
		appendControllerFlashlightLayers(buffer, args, group, fillMix, baseStrength, typeIntensityScale, strobeBoost);
		return;
	}
	const variantCount = Math.min(
		PASSTHROUGH_MAX_LIGHT_LAYERS,
		(group.type === "beam" ? 3 : (group.type === "wash" ? 2 : 1)) +
		(group.type === "wash" ? (surfaceBudget.washVariantCountBoost || 0) : (group.type === "beam" ? (surfaceBudget.beamVariantCountBoost || 0) : (surfaceBudget.strobeVariantCountBoost || 0)))
	);
	for (let i = 0; i < variantCount && buffer.count < PASSTHROUGH_MAX_LIGHT_LAYERS; i += 1) {
		const variantCenter = variantCount === 1 ? 0 : (i / (variantCount - 1)) - 0.5;
		const variantOffset = variantCenter * sweep * (group.type === "beam" ? (surfaceKey === "wall" ? 0.64 : 0.52) : (surfaceKey === "floor" ? 0.3 : 0.24));
		const roomPoint = getRoomPointForFixtureGroup(group, variantOffset, fillMix, surfaceBudget, stereoBiasOffset);
		const effectState = getFixtureEffectState({
			group: group,
			audioMetrics: args.audioMetrics,
			fillMix: fillMix,
			variantCenter: variantCenter,
			stereoBiasOffset: stereoBiasOffset
		});
		const worldRadii = getFixtureWorldRadii(group, effectState, fillMix, surfaceBudget, surfaceKey, shouldUseSurfaceDepth(clubState, args));
		const surfaceState = getSurfaceProjectionState(
			args,
			clubState,
			roomPoint,
			group.anchorType,
			worldRadii.radiusX,
			worldRadii.radiusY
		);
		if (!surfaceState) {
			continue;
		}
		appendProjectedLightLayer(buffer, {
			centerUvX: surfaceState.maskState.x,
			centerUvY: surfaceState.maskState.y,
			colorR: group.color[0],
			colorG: group.color[1],
			colorB: group.color[2],
			radiusUvX: surfaceState.maskState.radiusX,
			radiusUvY: surfaceState.maskState.radiusY,
			rotation: surfaceState.maskState.rotation,
			softnessUv: clampNumber((group.softness == null ? 0.16 : group.softness) + surfaceBudget.softnessBias, 0.04, 0.4),
			worldCenterX: surfaceState.centerPoint.x,
			worldCenterY: surfaceState.centerPoint.y,
			worldCenterZ: surfaceState.centerPoint.z,
			worldBasisXX: surfaceState.tangentX.x,
			worldBasisXY: surfaceState.tangentX.y,
			worldBasisXZ: surfaceState.tangentX.z,
			worldBasisYX: surfaceState.tangentY.x,
			worldBasisYY: surfaceState.tangentY.y,
			worldBasisYZ: surfaceState.tangentY.z,
			worldRadiusX: surfaceState.radiusX,
			worldRadiusY: surfaceState.radiusY,
			worldSoftness: clampNumber(Math.min(surfaceState.radiusX, surfaceState.radiusY) * 0.22, 0.05, 0.28),
			worldPlaneWidth: clampNumber(Math.min(surfaceState.radiusX, surfaceState.radiusY) * 0.32, 0.08, 0.34),
			surfaceDepthBool: surfaceState.surfaceDepthBool,
			alphaBlendStrength: effectState.alphaBlendStrength,
			effectType: effectState.type,
			effectPhase: effectState.phase,
			effectDensity: effectState.density,
			effectAmount: effectState.amount,
			strength: clampNumber(
				surfaceBudget.minimumStrength +
				baseStrength * surfaceBudget.strengthScale * typeIntensityScale * strobeBoost * (effectState.mode === FIXTURE_EFFECT_MODE_FLASHLIGHT ? 1 : (group.type === "beam" ? 0.72 : 1)) * (1 - Math.abs(variantCenter) * 0.16),
				0,
				group.type === "strobe" ? 0.88 : 0.72
			)
		});
	}
};

const buildDirectionalLightLayers = function(args, controllerState, buffer) {
	if (!controllerState || controllerState.lightingModeKey !== "spots") {
		return buffer;
	}
	const lightingState = args.sceneLightingState;
	if (!lightingState) {
		return buffer;
	}
	const rankedLights = [];
	for (let i = 0; i < lightingState.lightStrengths.length; i += 1) {
		const strength = Math.max(0, lightingState.lightStrengths[i] || 0);
		if (strength <= 0.0001) {
			continue;
		}
		const directionOffset = i * 3;
		const colorOffset = i * 3;
		rankedLights.push({
			strength: strength,
			dirX: lightingState.lightDirections[directionOffset],
			dirY: lightingState.lightDirections[directionOffset + 1],
			dirZ: lightingState.lightDirections[directionOffset + 2],
			r: lightingState.lightColors[colorOffset],
			g: lightingState.lightColors[colorOffset + 1],
			b: lightingState.lightColors[colorOffset + 2]
		});
	}
	rankedLights.sort(function(a, b) {
		return b.strength - a.strength;
	});
	const audioDrive = controllerState.smoothedAudioDrive || 0;
	for (let i = 0; i < rankedLights.length && i < PASSTHROUGH_MAX_LIGHT_LAYERS; i += 1) {
		const light = rankedLights[i];
		const ceilingPoint = getRoomCeilingLightPoint(light.dirX, light.dirY, light.dirZ);
		const roomTargets = [
			{
				point: ceilingPoint,
				anchorType: "ceiling",
				radiusX: clampNumber(0.48 + audioDrive * 0.34 + light.strength * 0.26 + i * 0.03, 0.32, 1.18),
				radiusY: clampNumber(0.48 + audioDrive * 0.34 + light.strength * 0.26 + i * 0.03, 0.32, 1.18),
				strength: clampNumber(0.18 + light.strength * 0.24 + audioDrive * 0.22, 0, 0.72)
			},
			{
				point: getRoomFloorLightPoint(ceilingPoint),
				anchorType: "floor",
				radiusX: clampNumber(0.64 + audioDrive * 0.44 + light.strength * 0.32 + i * 0.04, 0.42, 1.42),
				radiusY: clampNumber(0.72 + audioDrive * 0.48 + light.strength * 0.34 + i * 0.04, 0.44, 1.56),
				strength: clampNumber(0.08 + light.strength * 0.16 + audioDrive * 0.18, 0, 0.46)
			},
			{
				point: getRoomWallLightPoint(ceilingPoint, 0.62),
				anchorType: "wall",
				radiusX: clampNumber(0.58 + audioDrive * 0.28 + light.strength * 0.24 + i * 0.03, 0.36, 1.16),
				radiusY: clampNumber(0.52 + audioDrive * 0.22 + light.strength * 0.2 + i * 0.03, 0.34, 0.96),
				strength: clampNumber(0.1 + light.strength * 0.18 + audioDrive * 0.18, 0, 0.52)
			}
		];
		for (let j = 0; j < roomTargets.length && buffer.count < PASSTHROUGH_MAX_LIGHT_LAYERS; j += 1) {
			const roomTarget = roomTargets[j];
			if (!roomTarget.point) {
				continue;
			}
			const surfaceState = getSurfaceProjectionState(
				args,
				controllerState,
				roomTarget.point,
				roomTarget.anchorType,
				roomTarget.radiusX,
				roomTarget.radiusY
			);
			if (!surfaceState) {
				continue;
			}
			appendProjectedLightLayer(buffer, {
				centerUvX: surfaceState.maskState.x,
				centerUvY: surfaceState.maskState.y,
				colorR: light.r,
				colorG: light.g,
				colorB: light.b,
				radiusUvX: surfaceState.maskState.radiusX,
				radiusUvY: surfaceState.maskState.radiusY,
				rotation: surfaceState.maskState.rotation,
				softnessUv: 0.12,
				worldCenterX: surfaceState.centerPoint.x,
				worldCenterY: surfaceState.centerPoint.y,
				worldCenterZ: surfaceState.centerPoint.z,
				worldBasisXX: surfaceState.tangentX.x,
				worldBasisXY: surfaceState.tangentX.y,
				worldBasisXZ: surfaceState.tangentX.z,
				worldBasisYX: surfaceState.tangentY.x,
				worldBasisYY: surfaceState.tangentY.y,
				worldBasisYZ: surfaceState.tangentY.z,
				worldRadiusX: surfaceState.radiusX,
				worldRadiusY: surfaceState.radiusY,
				worldSoftness: clampNumber(Math.min(surfaceState.radiusX, surfaceState.radiusY) * 0.22, 0.05, 0.28),
				worldPlaneWidth: clampNumber(Math.min(surfaceState.radiusX, surfaceState.radiusY) * 0.32, 0.08, 0.34),
				surfaceDepthBool: surfaceState.surfaceDepthBool,
				alphaBlendStrength: 0.94,
				effectType: 0,
				effectPhase: 0,
				effectDensity: 0,
				effectAmount: 0,
				strength: roomTarget.strength
			});
		}
	}
	return buffer;
};

const buildFixtureLightLayers = function(args, controllerState, buffer) {
	if (!controllerState || controllerState.lightingModeKey !== "club") {
		return buffer;
	}
	const lightingState = args.sceneLightingState;
	if (!lightingState || !lightingState.fixtureGroups || !lightingState.fixtureGroups.length) {
		return buffer;
	}
	const rankedGroups = getRankedFixtureGroups(lightingState.fixtureGroups);
	for (let i = 0; i < rankedGroups.length && buffer.count < PASSTHROUGH_MAX_LIGHT_LAYERS; i += 1) {
		appendClubFixtureLayers(buffer, args, rankedGroups[i], controllerState);
	}
	return buffer;
};

const getProjectedLightLayerModeKey = function(controllerState) {
	return controllerState && controllerState.lightingModeKey === "club" ? "club" : "spots";
};

const projectedLightLayerModeHandlers = {
	spots: function(args, controllerState, buffer) {
		return buildDirectionalLightLayers(args || {}, controllerState, buffer);
	},
	club: function(args, controllerState, buffer) {
		return buildFixtureLightLayers(args || {}, controllerState, buffer);
	}
};

// Central service entry so passthrough only consumes one shared projected-light buffer.
const buildProjectedLightLayers = function(args, controllerState) {
	const layerBuffer = getProjectedLightLayerBuffer(controllerState);
	const modeKey = getProjectedLightLayerModeKey(controllerState);
	const modeHandler = projectedLightLayerModeHandlers[modeKey] || projectedLightLayerModeHandlers.spots;
	resetProjectedLightLayerBuffer(layerBuffer);
	return modeHandler(args || {}, controllerState, layerBuffer);
};

// Presets

const addFixture = function(state, type, anchorType, azimuth, color, intensity, radius, options) {
	options = options || {};
	pushFixtureGroup(state, {
		type: type,
		anchorType: anchorType,
		azimuth: azimuth,
		color: color,
		intensity: intensity,
		radius: radius,
		softness: options.softness,
		sweep: options.sweep,
		vertical: options.vertical,
		pulseAmount: options.pulseAmount,
		strobeAmount: options.strobeAmount,
		stereoBias: options.stereoBias,
		effectMode: options.effectMode
	});
};

const addWashFixture = function(state, anchorType, azimuth, color, intensity, radius, options) {
	addFixture(state, "wash", anchorType, azimuth, color, intensity, radius, options);
};

const addBeamFixture = function(state, anchorType, azimuth, color, intensity, radius, options) {
	addFixture(state, "beam", anchorType, azimuth, color, intensity, radius, options);
};

const addStrobeFixture = function(state, anchorType, azimuth, color, intensity, radius, options) {
	addFixture(state, "strobe", anchorType, azimuth, color, intensity, radius, options);
};

const getHybridClubMetrics = function(audioMetrics) {
	audioMetrics = audioMetrics || emptyAudioMetrics;
	return {
		level: clampNumber(audioMetrics.level || 0, 0, 1),
		bass: clampNumber(audioMetrics.bass || 0, 0, 1),
		transient: clampNumber(audioMetrics.transient || 0, 0, 1),
		beatPulse: clampNumber(audioMetrics.beatPulse || 0, 0, 1),
		kickGate: clampNumber(audioMetrics.kickGate || 0, 0, 1),
		bassHit: clampNumber(audioMetrics.bassHit || 0, 0, 1),
		transientGate: clampNumber(audioMetrics.transientGate || 0, 0, 1),
		strobeGate: clampNumber(audioMetrics.strobeGate || 0, 0, 1),
		colorMomentum: clampNumber(audioMetrics.colorMomentum || 0, 0, 1),
		motionEnergy: clampNumber(audioMetrics.motionEnergy || 0, 0, 1),
		roomFill: clampNumber(audioMetrics.roomFill || 0, 0, 1),
		leftImpact: clampNumber(audioMetrics.leftImpact || 0, 0, 1),
		rightImpact: clampNumber(audioMetrics.rightImpact || 0, 0, 1),
		stereoBalance: clampNumber(audioMetrics.stereoBalance || 0, -1, 1),
		stereoWidth: clampNumber(audioMetrics.stereoWidth || 0, 0, 1)
	};
};

const buildLightingPreset = function(ambientBase, fixtureBuilder) {
	return function(state, timeSeconds, audioMetrics) {
		fixtureBuilder(state, timeSeconds, getHybridClubMetrics(audioMetrics));
		applyFixtureGroupsToLightingState(state, ambientBase);
	};
};

const buildTestLabVariantLightingPreset = function(defaultVariantKey, variantDefinitions) {
	return function(state, timeSeconds, audioMetrics, variantKey) {
		const metrics = getHybridClubMetrics(audioMetrics);
		const variantDefinition = variantDefinitions[variantKey] || variantDefinitions[defaultVariantKey];
		if (!variantDefinition) {
			return;
		}
		variantDefinition.buildFixtures(state, timeSeconds, metrics);
		applyFixtureGroupsToLightingState(state, variantDefinition.ambientBase);
	};
};

const auroraDrift = buildLightingPreset(0.34, function(state, timeSeconds, metrics) {
	const bandHueA = wrapUnit(0.34 + timeSeconds * 0.004 + metrics.colorMomentum * 0.012);
	const bandHueB = wrapUnit(bandHueA + 0.08);
	const bandHueC = wrapUnit(bandHueA + 0.2);
	const glowHue = wrapUnit(bandHueA + 0.48);
	addWashFixture(state, "ceiling", timeSeconds * 0.06 + 0.18, hslToRgb(bandHueA, 0.88, 0.56), 0.4 + metrics.roomFill * 0.28, 0.82, {softness: 0.28, sweep: 0.18, effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN});
	addWashFixture(state, "ceiling", -(timeSeconds * 0.05) + 0.72, hslToRgb(bandHueB, 0.82, 0.6), 0.36 + metrics.roomFill * 0.24, 0.76, {softness: 0.3, sweep: 0.18, effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN});
	addWashFixture(state, "ceiling", timeSeconds * 0.04 + 1.34, hslToRgb(bandHueC, 0.76, 0.62), 0.3 + metrics.roomFill * 0.22, 0.7, {softness: 0.32, sweep: 0.16, effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN});
	addWashFixture(state, "floor", -(timeSeconds * 0.03) + 4.1, hslToRgb(glowHue, 0.54, 0.54), 0.1 + metrics.bassHit * 0.12 + metrics.roomFill * 0.06, 0.76, {softness: 0.44, sweep: 0.06, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addBeamFixture(state, "wall", timeSeconds * 0.08 + 1.9, hslToRgb(wrapUnit(bandHueA + 0.04), 0.72, 0.62), 0.06 + metrics.leftImpact * 0.24 + metrics.stereoWidth * 0.06, 0.34, {softness: 0.2, sweep: 0.24, vertical: 0.6, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addBeamFixture(state, "wall", -(timeSeconds * 0.08) + 4.7, hslToRgb(wrapUnit(bandHueB + 0.1), 0.72, 0.64), 0.06 + metrics.rightImpact * 0.24 + metrics.stereoWidth * 0.06, 0.34, {softness: 0.2, sweep: 0.24, vertical: 0.6, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_NONE});
});

const discoStorm = buildLightingPreset(0.12, function(state, timeSeconds, metrics) {
	const sweepHue = wrapUnit(0.96 + timeSeconds * (0.24 + metrics.colorMomentum * 0.08));
	addWashFixture(state, "ceiling", timeSeconds * 0.92 + metrics.bass * 1.1, hslToRgb(wrapUnit(sweepHue + 0.02), 0.98, 0.6), 0.14 + metrics.roomFill * 0.16 + metrics.bassHit * 0.16, 0.56, {softness: 0.16, sweep: 0.56, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addWashFixture(state, "floor", -(timeSeconds * 0.82) + 1.2, hslToRgb(wrapUnit(sweepHue + 0.46), 0.98, 0.58), 0.16 + metrics.kickGate * 0.28 + metrics.roomFill * 0.12, 0.8, {softness: 0.2, sweep: 0.4, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addBeamFixture(state, "wall", -(timeSeconds * 1.12) + 1.4, hslToRgb(wrapUnit(sweepHue + 0.22), 1, 0.58), 0.28 + metrics.leftImpact * 0.74 + metrics.motionEnergy * 0.24, 0.3, {softness: 0.05, sweep: 1.3, vertical: 0.64, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addBeamFixture(state, "wall", timeSeconds * 1.24 + 4.2, hslToRgb(wrapUnit(sweepHue + 0.72), 1, 0.6), 0.28 + metrics.rightImpact * 0.74 + metrics.motionEnergy * 0.24, 0.3, {softness: 0.05, sweep: 1.3, vertical: 0.64, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addBeamFixture(state, "wall", timeSeconds * 0.84 + 0.6, hslToRgb(wrapUnit(sweepHue + 0.1), 0.96, 0.62), 0.16 + metrics.motionEnergy * 0.28 + metrics.transientGate * 0.22, 0.24, {softness: 0.04, sweep: 1.18, vertical: 0.76, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addBeamFixture(state, "wall", -(timeSeconds * 0.88) + 5.4, hslToRgb(wrapUnit(sweepHue + 0.58), 0.96, 0.62), 0.16 + metrics.motionEnergy * 0.28 + metrics.transientGate * 0.22, 0.24, {softness: 0.04, sweep: 1.18, vertical: 0.76, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addStrobeFixture(state, "ceiling", timeSeconds * 1.54 + 2.7, hslToRgb(wrapUnit(sweepHue + 0.62), 1, 0.74), 0.18 + metrics.transientGate * 0.46 + metrics.strobeGate * 0.38, 0.22, {softness: 0.03, sweep: 0.72, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addStrobeFixture(state, "ceiling", -(timeSeconds * 1.36) + 5.1, hslToRgb(wrapUnit(sweepHue + 0.14), 1, 0.74), 0.14 + metrics.transientGate * 0.32 + metrics.strobeGate * 0.28, 0.2, {softness: 0.03, sweep: 0.7, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addStrobeFixture(state, "wall", timeSeconds * 1.18 + 1.9, hslToRgb(wrapUnit(sweepHue + 0.88), 1, 0.72), 0.1 + metrics.transientGate * 0.3 + metrics.strobeGate * 0.28, 0.2, {softness: 0.03, sweep: 0.86, vertical: 0.72, stereoBias: metrics.stereoBalance >= 0 ? -1 : 1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE});
	addStrobeFixture(state, "wall", -(timeSeconds * 1.02) + 4.4, hslToRgb(wrapUnit(sweepHue + 0.4), 1, 0.72), 0.08 + metrics.transientGate * 0.24 + metrics.strobeGate * 0.22, 0.18, {softness: 0.03, sweep: 0.74, vertical: 0.64, stereoBias: metrics.stereoBalance >= 0 ? 1 : -1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
});

const neonWash = buildLightingPreset(0.42, function(state, timeSeconds, metrics) {
	const baseHue = wrapUnit(0.08 + timeSeconds * (0.016 + metrics.colorMomentum * 0.03));
	addWashFixture(state, "ceiling", timeSeconds * 0.05, hslToRgb(baseHue, 0.96, 0.6), 0.48 + metrics.roomFill * 0.52, 1.28, {softness: 0.42, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addWashFixture(state, "ceiling", -(timeSeconds * 0.04) + 2.2, hslToRgb(wrapUnit(baseHue + 0.18), 0.92, 0.62), 0.46 + metrics.roomFill * 0.44, 1.2, {softness: 0.44, sweep: 0.1, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addWashFixture(state, "ceiling", timeSeconds * 0.03 + 4.1, hslToRgb(wrapUnit(baseHue + 0.34), 0.9, 0.62), 0.32 + metrics.roomFill * 0.28, 1.12, {softness: 0.44, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addWashFixture(state, "floor", timeSeconds * 0.03 + 1.4, hslToRgb(wrapUnit(baseHue + 0.5), 0.86, 0.58), 0.3 + metrics.bassHit * 0.32 + metrics.kickGate * 0.12, 1.2, {softness: 0.42, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addWashFixture(state, "floor", -(timeSeconds * 0.02) + 4.2, hslToRgb(wrapUnit(baseHue + 0.68), 0.74, 0.56), 0.24 + metrics.roomFill * 0.22 + metrics.bassHit * 0.2, 1.08, {softness: 0.44, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addWashFixture(state, "wall", timeSeconds * 0.04 + 4.9, hslToRgb(wrapUnit(baseHue + 0.08), 0.86, 0.58), 0.18 + metrics.roomFill * 0.2, 0.92, {softness: 0.34, sweep: 0.18, vertical: 0.54, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addWashFixture(state, "wall", -(timeSeconds * 0.04) + 1.7, hslToRgb(wrapUnit(baseHue + 0.24), 0.82, 0.6), 0.18 + metrics.roomFill * 0.2, 0.92, {softness: 0.34, sweep: 0.18, vertical: 0.54, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addBeamFixture(state, "wall", timeSeconds * 0.06 + 4.3, hslToRgb(wrapUnit(baseHue + 0.8), 0.88, 0.64), 0.04 + metrics.motionEnergy * 0.08 + metrics.stereoWidth * 0.06, 0.36, {softness: 0.22, sweep: 0.14, vertical: 0.52, effectMode: FIXTURE_EFFECT_MODE_NONE});
});

const stereoChase = buildLightingPreset(0.12, function(state, timeSeconds, metrics) {
	const centerBias = metrics.stereoBalance * 0.42;
	const leftHue = wrapUnit(0.56 + timeSeconds * 0.07 + metrics.colorMomentum * 0.04);
	const rightHue = wrapUnit(leftHue + 0.34);
	addBeamFixture(state, "wall", timeSeconds * 0.56 + 2.1 + centerBias, hslToRgb(leftHue, 0.98, 0.62), 0.28 + metrics.leftImpact * 1.02 + metrics.stereoWidth * 0.28, 0.32, {softness: 0.05, sweep: 1.34, vertical: 0.62, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addBeamFixture(state, "wall", -(timeSeconds * 0.53) + 5.2 + centerBias, hslToRgb(rightHue, 0.98, 0.62), 0.28 + metrics.rightImpact * 1.02 + metrics.stereoWidth * 0.28, 0.32, {softness: 0.05, sweep: 1.34, vertical: 0.62, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addBeamFixture(state, "wall", -(timeSeconds * 0.34) + 1.4 + centerBias * 0.5, hslToRgb(wrapUnit(leftHue + 0.08), 0.9, 0.66), 0.14 + metrics.leftImpact * 0.56 + metrics.stereoWidth * 0.08, 0.24, {softness: 0.06, sweep: 0.9, vertical: 0.78, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addBeamFixture(state, "wall", timeSeconds * 0.32 + 4.6 + centerBias * 0.5, hslToRgb(wrapUnit(rightHue + 0.08), 0.9, 0.66), 0.14 + metrics.rightImpact * 0.56 + metrics.stereoWidth * 0.08, 0.24, {softness: 0.06, sweep: 0.9, vertical: 0.78, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addWashFixture(state, "ceiling", timeSeconds * 0.12 + 0.7, hslToRgb(wrapUnit(leftHue + 0.14), 0.72, 0.56), 0.08 + metrics.roomFill * 0.14, 0.62, {softness: 0.2, sweep: 0.14, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addWashFixture(state, "floor", -(timeSeconds * 0.1) + 3.2, hslToRgb(wrapUnit(rightHue + 0.08), 0.72, 0.54), 0.14 + metrics.bassHit * 0.24 + metrics.roomFill * 0.14, 0.76, {softness: 0.2, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addWashFixture(state, "floor", timeSeconds * 0.12 + 0.9, hslToRgb(wrapUnit(leftHue + 0.36), 0.76, 0.56), 0.14 + metrics.bassHit * 0.24 + metrics.roomFill * 0.14, 0.76, {softness: 0.2, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addStrobeFixture(state, "wall", timeSeconds * 0.68 + 1.5, hslToRgb(wrapUnit(leftHue + 0.5), 1, 0.74), 0.1 + metrics.transientGate * 0.3 + metrics.stereoWidth * 0.16, 0.2, {softness: 0.04, sweep: 0.6, vertical: 0.72, stereoBias: -1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addStrobeFixture(state, "wall", -(timeSeconds * 0.66) + 4.9, hslToRgb(wrapUnit(rightHue + 0.5), 1, 0.74), 0.1 + metrics.transientGate * 0.3 + metrics.stereoWidth * 0.16, 0.2, {softness: 0.04, sweep: 0.6, vertical: 0.72, stereoBias: 1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
});

const pulseStrobe = buildLightingPreset(0.08, function(state, timeSeconds, metrics) {
	const pulseHue = wrapUnit(0.02 + timeSeconds * (0.14 + metrics.colorMomentum * 0.08));
	const strobeHue = wrapUnit(pulseHue + 0.42);
	addWashFixture(state, "ceiling", timeSeconds * 0.18, hslToRgb(pulseHue, 0.92, 0.58), 0.08 + metrics.roomFill * 0.1 + metrics.kickGate * 0.08, 0.52, {softness: 0.14, sweep: 0.22, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addWashFixture(state, "floor", -(timeSeconds * 0.16) + 2.2, hslToRgb(wrapUnit(pulseHue + 0.24), 0.84, 0.54), 0.1 + metrics.bassHit * 0.16 + metrics.kickGate * 0.1, 0.62, {softness: 0.16, sweep: 0.18, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addBeamFixture(state, "wall", timeSeconds * 0.78 + 1.4, hslToRgb(wrapUnit(pulseHue + 0.54), 1, 0.64), 0.24 + metrics.leftImpact * 0.62 + metrics.transientGate * 0.28, 0.2, {softness: 0.04, sweep: 1.36, vertical: 0.68, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addBeamFixture(state, "wall", -(timeSeconds * 0.74) + 4.8, hslToRgb(wrapUnit(pulseHue + 0.78), 1, 0.64), 0.24 + metrics.rightImpact * 0.62 + metrics.transientGate * 0.28, 0.2, {softness: 0.04, sweep: 1.36, vertical: 0.68, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addStrobeFixture(state, "ceiling", timeSeconds * 1.12 + 0.5, hslToRgb(strobeHue, 1, 0.78), 0.24 + metrics.transientGate * 0.46 + metrics.strobeGate * 0.5, 0.18, {softness: 0.02, sweep: 0.76, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addStrobeFixture(state, "ceiling", -(timeSeconds * 1.04) + 2.1, hslToRgb(wrapUnit(strobeHue + 0.18), 1, 0.76), 0.18 + metrics.transientGate * 0.38 + metrics.strobeGate * 0.4, 0.16, {softness: 0.02, sweep: 0.72, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addStrobeFixture(state, "wall", timeSeconds * 0.92 + 3.0, hslToRgb(wrapUnit(strobeHue + 0.3), 1, 0.74), 0.14 + metrics.transientGate * 0.3 + metrics.strobeGate * 0.34, 0.16, {softness: 0.02, sweep: 0.88, vertical: 0.74, stereoBias: metrics.stereoBalance >= 0 ? 1 : -1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE});
	addStrobeFixture(state, "wall", -(timeSeconds * 0.88) + 1.7, hslToRgb(wrapUnit(strobeHue + 0.56), 1, 0.72), 0.12 + metrics.transientGate * 0.26 + metrics.strobeGate * 0.3, 0.16, {softness: 0.02, sweep: 0.8, vertical: 0.68, stereoBias: metrics.stereoBalance >= 0 ? -1 : 1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE});
});

const createLightingPresetDefinition = function(name, description, buildState) {
	return {
		name: name,
		description: description,
		buildState: buildState
	};
};

const lightingPresetDefinitions = [
	createLightingPresetDefinition("Aurora Drift", "Slow aurora-like ceiling light bands with cool floor glow", auroraDrift),
	createLightingPresetDefinition("Disco Storm", "Chaotic mixed beams with ceiling hits and cutout wall strobes", discoStorm),
	createLightingPresetDefinition("Neon Wash", "Massive ceiling-wall color fill with soft floor underglow", neonWash),
	createLightingPresetDefinition("Stereo Chase", "Hard mirrored side runners with split-color floor chase", stereoChase),
	createLightingPresetDefinition("Pulse Strobe", "Dark peak-heavy rig with sharp ceiling hits and wall cut strobes", pulseStrobe)
];

// TestLab presets
// Isolated single-effect presets for TestLab.html.

const buildTestLabSoftWash = buildTestLabVariantLightingPreset("ceiling", {
	wall: {
		ambientBase: 0.2,
		buildFixtures: function(state, timeSeconds, metrics) {
			const hueA = wrapUnit(0.54 + timeSeconds * 0.02 + metrics.colorMomentum * 0.03);
			const hueB = wrapUnit(hueA + 0.06);
			addWashFixture(state, "wall", timeSeconds * 0.04 + 1.18, hslToRgb(hueA, 0.8, 0.58), 0.22 + metrics.roomFill * 0.14, 1.02, {softness: 0.38, sweep: 0.16, vertical: 0.56, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_NONE});
			addWashFixture(state, "wall", -(timeSeconds * 0.035) + 4.72, hslToRgb(hueB, 0.74, 0.62), 0.22 + metrics.roomFill * 0.14, 1.02, {softness: 0.4, sweep: 0.16, vertical: 0.56, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_NONE});
		}
	},
	floor: {
		ambientBase: 0.18,
		buildFixtures: function(state, timeSeconds, metrics) {
			const hueA = wrapUnit(0.54 + timeSeconds * 0.02 + metrics.colorMomentum * 0.03);
			const hueB = wrapUnit(hueA + 0.06);
			addWashFixture(state, "floor", timeSeconds * 0.04 + 0.62, hslToRgb(hueA, 0.78, 0.56), 0.2 + metrics.bassHit * 0.18 + metrics.roomFill * 0.1, 1.1, {softness: 0.42, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_NONE});
			addWashFixture(state, "floor", -(timeSeconds * 0.03) + 3.46, hslToRgb(hueB, 0.72, 0.6), 0.18 + metrics.bassHit * 0.16 + metrics.roomFill * 0.1, 1.02, {softness: 0.44, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_NONE});
		}
	},
	ceiling: {
		ambientBase: 0.28,
		buildFixtures: function(state, timeSeconds, metrics) {
			const hueA = wrapUnit(0.54 + timeSeconds * 0.02 + metrics.colorMomentum * 0.03);
			const hueB = wrapUnit(hueA + 0.06);
			addWashFixture(state, "ceiling", timeSeconds * 0.04 - 0.22, hslToRgb(hueA, 0.82, 0.58), 0.34 + metrics.roomFill * 0.18, 1.2, {softness: 0.4, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_NONE});
			addWashFixture(state, "ceiling", -(timeSeconds * 0.035) + 0.34, hslToRgb(hueB, 0.76, 0.62), 0.3 + metrics.roomFill * 0.16, 1.08, {softness: 0.42, sweep: 0.1, effectMode: FIXTURE_EFFECT_MODE_NONE});
		}
	}
});

const buildTestLabShutters = buildTestLabVariantLightingPreset("ceiling", {
	wall: {
		ambientBase: 0.18,
		buildFixtures: function(state, timeSeconds, metrics) {
			const hueA = wrapUnit(0.96 + timeSeconds * 0.035 + metrics.colorMomentum * 0.03);
			const hueB = wrapUnit(hueA + 0.09);
			addWashFixture(state, "wall", timeSeconds * 0.06 + 1.1, hslToRgb(hueA, 0.9, 0.6), 0.24 + metrics.roomFill * 0.14, 0.88, {softness: 0.24, sweep: 0.22, vertical: 0.58, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_SHUTTERS});
			addWashFixture(state, "wall", -(timeSeconds * 0.05) + 4.8, hslToRgb(hueB, 0.82, 0.62), 0.22 + metrics.roomFill * 0.12, 0.82, {softness: 0.24, sweep: 0.2, vertical: 0.58, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_SHUTTERS});
		}
	},
	ceiling: {
		ambientBase: 0.22,
		buildFixtures: function(state, timeSeconds, metrics) {
			const hueA = wrapUnit(0.96 + timeSeconds * 0.035 + metrics.colorMomentum * 0.03);
			const hueB = wrapUnit(hueA + 0.09);
			addWashFixture(state, "ceiling", timeSeconds * 0.06 - 0.18, hslToRgb(hueA, 0.92, 0.6), 0.34 + metrics.roomFill * 0.16, 0.96, {softness: 0.26, sweep: 0.18, effectMode: FIXTURE_EFFECT_MODE_SHUTTERS});
			addWashFixture(state, "ceiling", -(timeSeconds * 0.05) + 0.42, hslToRgb(hueB, 0.84, 0.62), 0.28 + metrics.roomFill * 0.14, 0.84, {softness: 0.28, sweep: 0.16, effectMode: FIXTURE_EFFECT_MODE_SHUTTERS});
		}
	}
});

const buildTestLabEdgeRunner = buildTestLabVariantLightingPreset("wall", {
	ceiling: {
		ambientBase: 0.12,
		buildFixtures: function(state, timeSeconds, metrics) {
			const leftHue = wrapUnit(0.58 + timeSeconds * 0.06);
			const rightHue = wrapUnit(leftHue + 0.34);
			addBeamFixture(state, "ceiling", timeSeconds * 0.44 + 0.9, hslToRgb(leftHue, 0.98, 0.62), 0.24 + metrics.leftImpact * 0.5 + metrics.motionEnergy * 0.14, 0.26, {softness: 0.04, sweep: 1.22, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
			addBeamFixture(state, "ceiling", -(timeSeconds * 0.42) + 3.8, hslToRgb(rightHue, 0.98, 0.62), 0.24 + metrics.rightImpact * 0.5 + metrics.motionEnergy * 0.14, 0.26, {softness: 0.04, sweep: 1.22, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
		}
	},
	wall: {
		ambientBase: 0.16,
		buildFixtures: function(state, timeSeconds, metrics) {
			const leftHue = wrapUnit(0.58 + timeSeconds * 0.06);
			const rightHue = wrapUnit(leftHue + 0.34);
			addBeamFixture(state, "wall", timeSeconds * 0.48 + 1.8, hslToRgb(leftHue, 0.98, 0.62), 0.36 + metrics.leftImpact * 0.82 + metrics.stereoWidth * 0.18, 0.28, {softness: 0.05, sweep: 1.36, vertical: 0.7, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
			addBeamFixture(state, "wall", -(timeSeconds * 0.46) + 4.9, hslToRgb(rightHue, 0.98, 0.62), 0.36 + metrics.rightImpact * 0.82 + metrics.stereoWidth * 0.18, 0.28, {softness: 0.05, sweep: 1.36, vertical: 0.7, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
		}
	}
});

const buildTestLabSilhouetteCut = buildTestLabVariantLightingPreset("wall", {
	wall: {
		ambientBase: 0.1,
		buildFixtures: function(state, timeSeconds, metrics) {
			const hue = wrapUnit(0.1 + timeSeconds * 0.08);
			addStrobeFixture(state, "wall", timeSeconds * 0.44 + 1.2, hslToRgb(hue, 1, 0.72), 0.28 + metrics.transientGate * 0.44 + metrics.strobeGate * 0.26, 0.24, {softness: 0.04, sweep: 0.72, vertical: 0.7, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE});
		}
	},
	ceiling: {
		ambientBase: 0.1,
		buildFixtures: function(state, timeSeconds, metrics) {
			const hue = wrapUnit(0.1 + timeSeconds * 0.08);
			addStrobeFixture(state, "ceiling", timeSeconds * 0.44 + 1.2, hslToRgb(hue, 1, 0.72), 0.28 + metrics.transientGate * 0.44 + metrics.strobeGate * 0.26, 0.24, {softness: 0.04, sweep: 0.66, vertical: 0.55, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE});
		}
	}
});

const buildTestLabRoomWindowBeat = buildTestLabVariantLightingPreset("wall", {
	wall: {
		ambientBase: 0.1,
		buildFixtures: function(state, timeSeconds, metrics) {
			const hue = wrapUnit(0.34 + timeSeconds * 0.08);
			addStrobeFixture(state, "wall", timeSeconds * 0.52 + 1.4, hslToRgb(hue, 0.98, 0.68), 0.26 + metrics.beatPulse * 0.38 + metrics.strobeGate * 0.24, 0.24, {softness: 0.04, sweep: 0.76, vertical: 0.68, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
		}
	},
	ceiling: {
		ambientBase: 0.1,
		buildFixtures: function(state, timeSeconds, metrics) {
			const hue = wrapUnit(0.34 + timeSeconds * 0.08);
			addStrobeFixture(state, "ceiling", timeSeconds * 0.52 + 1.4, hslToRgb(hue, 0.98, 0.68), 0.26 + metrics.beatPulse * 0.38 + metrics.strobeGate * 0.24, 0.24, {softness: 0.04, sweep: 0.7, vertical: 0.56, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
		}
	}
});

const buildTestLabAuroraCurtain = buildTestLabVariantLightingPreset("ceiling", {
	wall: {
		ambientBase: 0.18,
		buildFixtures: function(state, timeSeconds, metrics) {
			const bandHueA = wrapUnit(0.34 + timeSeconds * 0.004 + metrics.colorMomentum * 0.012);
			const bandHueB = wrapUnit(bandHueA + 0.1);
			const bandHueC = wrapUnit(bandHueA + 0.22);
			addWashFixture(state, "wall", timeSeconds * 0.06 + 1.1, hslToRgb(bandHueA, 0.88, 0.56), 0.26 + metrics.roomFill * 0.18, 0.74, {softness: 0.24, sweep: 0.2, vertical: 0.54, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN});
			addWashFixture(state, "wall", -(timeSeconds * 0.05) + 4.76, hslToRgb(bandHueB, 0.82, 0.6), 0.22 + metrics.roomFill * 0.16, 0.7, {softness: 0.24, sweep: 0.18, vertical: 0.54, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN});
			addWashFixture(state, "wall", timeSeconds * 0.04 + 2.96, hslToRgb(bandHueC, 0.76, 0.62), 0.18 + metrics.roomFill * 0.14, 0.64, {softness: 0.24, sweep: 0.16, vertical: 0.62, effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN});
		}
	},
	ceiling: {
		ambientBase: 0.24,
		buildFixtures: function(state, timeSeconds, metrics) {
			const bandHueA = wrapUnit(0.34 + timeSeconds * 0.004 + metrics.colorMomentum * 0.012);
			const bandHueB = wrapUnit(bandHueA + 0.1);
			const bandHueC = wrapUnit(bandHueA + 0.22);
			addWashFixture(state, "ceiling", timeSeconds * 0.06 + 0.18, hslToRgb(bandHueA, 0.88, 0.56), 0.42 + metrics.roomFill * 0.28, 0.82, {softness: 0.28, sweep: 0.18, effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN});
			addWashFixture(state, "ceiling", -(timeSeconds * 0.05) + 0.72, hslToRgb(bandHueB, 0.82, 0.6), 0.38 + metrics.roomFill * 0.26, 0.76, {softness: 0.3, sweep: 0.18, effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN});
			addWashFixture(state, "ceiling", timeSeconds * 0.04 + 1.34, hslToRgb(bandHueC, 0.76, 0.62), 0.34 + metrics.roomFill * 0.22, 0.7, {softness: 0.32, sweep: 0.16, effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN});
		}
	}
});

const buildTestLabFloorHalo = buildTestLabVariantLightingPreset("floor", {
	floor: {
		ambientBase: 0.18,
		buildFixtures: function(state, timeSeconds, metrics) {
			const hueA = wrapUnit(0.98 + timeSeconds * 0.04);
			const hueB = wrapUnit(hueA + 0.42);
			addWashFixture(state, "floor", timeSeconds * 0.16 + 0.8, hslToRgb(hueA, 0.9, 0.58), 0.24 + metrics.bassHit * 0.34 + metrics.kickGate * 0.16, 0.96, {softness: 0.34, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
			addWashFixture(state, "floor", -(timeSeconds * 0.14) + 3.1, hslToRgb(hueB, 0.88, 0.58), 0.24 + metrics.bassHit * 0.34 + metrics.kickGate * 0.16, 0.92, {softness: 0.34, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
		}
	},
	directional: {
		ambientBase: 0.18,
		buildFixtures: function(state, timeSeconds, metrics) {
			const hueA = wrapUnit(0.98 + timeSeconds * 0.04);
			const hueB = wrapUnit(hueA + 0.42);
			addWashFixture(state, "floor", timeSeconds * 0.16 + 0.38, hslToRgb(hueA, 0.9, 0.58), 0.24 + metrics.bassHit * 0.34 + metrics.kickGate * 0.16, 0.84, {softness: 0.28, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
			addWashFixture(state, "floor", -(timeSeconds * 0.14) + 3.62, hslToRgb(hueB, 0.88, 0.58), 0.24 + metrics.bassHit * 0.34 + metrics.kickGate * 0.16, 0.72, {softness: 0.26, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
		}
	}
});

const buildTestLabFlashlight = function(state, timeSeconds, audioMetrics, variantKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const beamColor = hslToRgb(wrapUnit(0.12 + timeSeconds * 0.01), 0.12, 0.86);
	addBeamFixture(state, "ceiling", 0.22, beamColor, 0.32 + metrics.level * 0.14 + metrics.roomFill * 0.1, 0.46, {
		softness: 0.08,
		sweep: 0.18,
		effectMode: FIXTURE_EFFECT_MODE_FLASHLIGHT
	});
	applyFixtureGroupsToLightingState(state, 0.08);
};

const createTestLabEffectDefinition = function(effectName, effectDescription, surfaceKey, effectBuilder) {
	return {
		effectName: effectName,
		effectDescription: effectDescription,
		surfaceKey: surfaceKey,
		buildState: function(state, timeSeconds, audioMetrics) {
			effectBuilder(state, timeSeconds, audioMetrics, surfaceKey);
		}
	};
};

const testLabLightingEffectDefinitions = [
	createTestLabEffectDefinition("Soft Wash", "Broad diffuse room-light fill for neutral additive-versus-alpha-blend evaluation.", "ceiling", buildTestLabSoftWash),
	createTestLabEffectDefinition("Shutters", "Structured sliced wash that should read like light shaping rather than glowing panels.", "ceiling", buildTestLabShutters),
	createTestLabEffectDefinition("Edge Runner", "Directed runner beam intended to travel along room structure instead of filling surfaces broadly.", "wall", buildTestLabEdgeRunner),
	createTestLabEffectDefinition("Silhouette Cut", "Hard alpha-blend cut that should open the room sharply instead of behaving like a wash.", "wall", buildTestLabSilhouetteCut),
	createTestLabEffectDefinition("Room Window Beat", "Rhythmic window-like alpha-blend opening keyed to beats rather than continuous motion or fill.", "wall", buildTestLabRoomWindowBeat),
	createTestLabEffectDefinition("Aurora Curtain", "Ribbon-like drifting bands that should read atmospheric rather than as broad wash blobs.", "ceiling", buildTestLabAuroraCurtain),
	createTestLabEffectDefinition("Floor Halo", "Localized underglow effect that should read as deliberate floor light rather than diffuse spill.", "floor", buildTestLabFloorHalo),
	createTestLabEffectDefinition("Flashlight", "Controller-oriented flashlight review mode inside the shared effect pipeline.", "controller", buildTestLabFlashlight)
];

const testLabLightingPresetDefinitions = testLabLightingEffectDefinitions.map(function(effectDefinition, effectIndex, effectDefinitions) {
	return {
		name: effectDefinition.effectName,
		description: effectDefinition.effectDescription,
		effectName: effectDefinition.effectName,
		effectDescription: effectDefinition.effectDescription,
		effectIndex: effectIndex,
		effectCount: effectDefinitions.length,
		variantKey: "",
		variantIndex: 0,
		variantCount: 1,
		variantLabel: "",
		surfaceKey: effectDefinition.surfaceKey,
		buildState: effectDefinition.buildState
	};
});
