// Shared fixture-effect semantics for preset authors and passthrough rendering.

const FIXTURE_EFFECT_MODE_NONE = "soft";
const FIXTURE_EFFECT_MODE_SHUTTERS = "shutters";
const FIXTURE_EFFECT_MODE_EDGE_RUNNER = "edgeRunner";
const FIXTURE_EFFECT_MODE_SILHOUETTE = "silhouette";
const FIXTURE_EFFECT_MODE_WINDOW_BEAT = "windowBeat";
const FIXTURE_EFFECT_MODE_AURORA_CURTAIN = "auroraCurtain";
const FIXTURE_EFFECT_MODE_FLOOR_HALO = "floorHalo";

const getDefaultFixtureEffectMode = function(type) {
	if (type === "wash") {
		return FIXTURE_EFFECT_MODE_SHUTTERS;
	}
	if (type === "beam") {
		return FIXTURE_EFFECT_MODE_EDGE_RUNNER;
	}
	if (type === "strobe") {
		return FIXTURE_EFFECT_MODE_WINDOW_BEAT;
	}
	return FIXTURE_EFFECT_MODE_NONE;
};

const getFixtureEffectTypeId = function(effectMode) {
	if (effectMode === FIXTURE_EFFECT_MODE_SHUTTERS) {
		return 1;
	}
	if (effectMode === FIXTURE_EFFECT_MODE_EDGE_RUNNER) {
		return 2;
	}
	if (effectMode === FIXTURE_EFFECT_MODE_SILHOUETTE) {
		return 3;
	}
	if (effectMode === FIXTURE_EFFECT_MODE_WINDOW_BEAT) {
		return 4;
	}
	if (effectMode === FIXTURE_EFFECT_MODE_AURORA_CURTAIN) {
		return 5;
	}
	if (effectMode === FIXTURE_EFFECT_MODE_FLOOR_HALO) {
		return 6;
	}
	return 0;
};

const getFixtureRevealStrength = function(type) {
	if (type === "wash") {
		return 0.72;
	}
	if (type === "beam") {
		return 1.06;
	}
	if (type === "strobe") {
		return 1.42;
	}
	return 0.94;
};

const getFixtureEffectState = function(args) {
	args = args || {};
	const group = args.group || {};
	const audioMetrics = args.audioMetrics || emptyAudioMetrics;
	const fillMix = clampNumber(args.fillMix == null ? 0 : args.fillMix, 0, 1);
	const variantCenter = clampNumber(args.variantCenter == null ? 0 : args.variantCenter, -1, 1);
	const stereoBiasOffset = clampNumber(args.stereoBiasOffset == null ? 0 : args.stereoBiasOffset, -1, 1);
	const effectMode = group.effectMode || getDefaultFixtureEffectMode(group.type);
	const effectType = getFixtureEffectTypeId(effectMode);
	let effectDensity = 0;
	let effectAmount = 0;
	if (effectType === 1) {
		effectDensity = 1.1 + fillMix * 1.8;
		effectAmount = fillMix;
	} else if (effectType === 2) {
		effectDensity = 0.8 + (audioMetrics.motionEnergy || 0) * 1.1;
		effectAmount = clampNumber((audioMetrics.motionEnergy || 0) * 0.7 + Math.abs(group.stereoBias || 0) * 0.25, 0, 1);
	} else if (effectType === 3) {
		effectDensity = 0.9;
		effectAmount = clampNumber((audioMetrics.transientGate || 0) * 0.8 + (audioMetrics.strobeGate || 0) * 0.4, 0, 1);
	} else if (effectType === 4) {
		effectDensity = 1.2;
		effectAmount = clampNumber((audioMetrics.beatPulse || 0) * 0.7 + (audioMetrics.strobeGate || 0) * 0.5, 0, 1);
	} else if (effectType === 5) {
		effectDensity = 1.36 + (audioMetrics.colorMomentum || 0) * 1.24 + fillMix * 0.42;
		effectAmount = clampNumber(0.42 + fillMix * 0.4 + (audioMetrics.colorMomentum || 0) * 0.3 + (audioMetrics.roomFill || 0) * 0.14, 0, 1);
	} else if (effectType === 6) {
		effectDensity = 0.72 + (audioMetrics.bass || 0) * 0.7 + (audioMetrics.bassHit || 0) * 0.4;
		effectAmount = clampNumber((audioMetrics.bassHit || 0) * 0.62 + (audioMetrics.kickGate || 0) * 0.26 + (audioMetrics.roomFill || 0) * 0.18, 0, 1);
	}
	return {
		mode: effectMode,
		type: effectType,
		phase: (group.azimuth || 0) * 0.28 + variantCenter * 0.92 + stereoBiasOffset * 0.6,
		density: effectDensity,
		amount: effectAmount,
		revealStrength: getFixtureRevealStrength(group.type)
	};
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
	"float amount=clamp(effectParams.w,0.0,1.0);",
	"if(effectType<0.5){",
	"return vec2(1.0,1.0);",
	"}",
	"if(effectType<1.5){",
	"float shutter=0.5+0.5*sin((localNorm.x*density+phase)*6.28318);",
	"shutter=smoothstep(0.18,0.82,shutter);",
	"return vec2(0.65+shutter*0.35,0.34+shutter*(0.58+amount*0.18));",
	"}",
	"if(effectType<2.5){",
	"float runnerCenter=sin(phase)*0.72;",
	"float runner=1.0-smoothstep(0.08,0.44,abs(localNorm.x-runnerCenter));",
	"float beamBand=1.0-smoothstep(0.1,0.48,abs(localNorm.y));",
	"float tipMask=smoothstep(0.24,0.96,abs(localNorm.x));",
	"return vec2(0.72+runner*0.28,max(beamBand*0.52,runner*tipMask*(0.82+amount*0.18)));",
	"}",
	"if(effectType<3.5){",
	"float cut=max(abs(localNorm.x)*0.92,abs(localNorm.y)*1.16);",
	"float window=1.0-smoothstep(0.22,0.62,cut);",
	"float rim=smoothstep(0.54,0.96,length(localNorm));",
	"return vec2(0.24+rim*0.3,window*(0.86+amount*0.14));",
	"}",
	"float window=max(abs(localNorm.x)*0.78,abs(localNorm.y)*1.08);",
	"float beatWindow=1.0-smoothstep(0.2,0.72,window);",
	"float pulse=0.5+0.5*sin((phase+amount*0.4)*6.28318);",
	"pulse=smoothstep(0.12,0.9,pulse);",
	"if(effectType<4.5){",
	"return vec2(0.26+beatWindow*0.24,beatWindow*(0.46+pulse*(0.44+amount*0.1)));",
	"}",
	"if(effectType<5.5){",
	"float bandA=0.5+0.5*sin((localNorm.x*(2.1+density*1.2)+localNorm.y*0.38+phase)*6.28318);",
	"float bandB=0.5+0.5*sin((localNorm.x*(3.2+density*0.7)-localNorm.y*0.24+phase*1.18)*6.28318);",
	"float sway=0.5+0.5*sin((localNorm.y*0.92+phase*0.7)*6.28318);",
	"bandA=smoothstep(0.58,0.92,bandA);",
	"bandB=smoothstep(0.64,0.96,bandB);",
	"sway=smoothstep(0.12,0.94,sway);",
	"float curtain=max(bandA,bandB*(0.72+amount*0.18));",
	"float aurora=curtain*(0.58+sway*0.42);",
	"return vec2(0.26+aurora*0.74,0.12+aurora*(0.72+amount*0.14));",
	"}",
	"float radial=length(localNorm*vec2(0.88,1.12));",
	"float haloPulse=0.5+0.5*sin((phase+amount*0.24)*6.28318);",
	"float core=1.0-smoothstep(0.06,0.54,radial);",
	"float ring=1.0-smoothstep(0.08,0.34,abs(radial-(0.3+haloPulse*0.22)));",
	"return vec2(0.54+core*0.18+ring*0.28,max(core*(0.64+amount*0.18),ring*(0.38+amount*0.16)));",
	"}"
].join("");
