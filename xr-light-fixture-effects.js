// Shared fixture-effect semantics for preset authors and passthrough rendering.

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
		alphaBlendStrength: 0.46,
		getState: function() {
			return {density: 0, amount: 0};
		},
		shaderLines: [
			"float radial=length(localNorm*vec2(0.92,1.08));",
			"float broad=1.0-smoothstep(0.08,1.0,radial);",
			"float plumeA=0.5+0.5*sin((localNorm.x*0.8+localNorm.y*0.24+phase)*6.28318);",
			"float plumeB=0.5+0.5*sin((localNorm.y*0.62-localNorm.x*0.16-phase*0.52)*6.28318);",
			"float cloud=smoothstep(0.2,0.88,plumeA*0.58+plumeB*0.42);",
			"return vec2(0.82+cloud*0.18,broad*(0.34+cloud*(0.24+amount*0.08)));"
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

const buildFixtureEffectShaderBranch = function(definition, branchIndex) {
	const branchOpen = branchIndex === 0 ? ("if(effectType<" + (definition.shaderType + 0.5).toFixed(1) + "){") : ("else if(effectType<" + (definition.shaderType + 0.5).toFixed(1) + "){");
	return [branchOpen].concat(definition.shaderLines).concat(["}"]);
};

const fixtureEffectFragmentSource = [
	"vec2 spotEffect(vec2 uv, vec2 center, vec4 params, vec4 effectParams){",
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
