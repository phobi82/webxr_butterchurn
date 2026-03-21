// Extend this file with more preset functions and register them below.

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

const auroraDrift = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const bandHueA = wrapUnit(0.34 + timeSeconds * 0.004 + metrics.colorMomentum * 0.012);
	const bandHueB = wrapUnit(bandHueA + 0.08);
	const bandHueC = wrapUnit(bandHueA + 0.2);
	const glowHue = wrapUnit(bandHueA + 0.48);
	addFixture(state, "wash", "ceiling", timeSeconds * 0.06 + 0.18, hslToRgb(bandHueA, 0.88, 0.56), 0.4 + metrics.roomFill * 0.28, 0.82, {softness: 0.28, sweep: 0.18, effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN});
	addFixture(state, "wash", "ceiling", -(timeSeconds * 0.05) + 0.72, hslToRgb(bandHueB, 0.82, 0.6), 0.36 + metrics.roomFill * 0.24, 0.76, {softness: 0.3, sweep: 0.18, effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN});
	addFixture(state, "wash", "ceiling", timeSeconds * 0.04 + 1.34, hslToRgb(bandHueC, 0.76, 0.62), 0.3 + metrics.roomFill * 0.22, 0.7, {softness: 0.32, sweep: 0.16, effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.03) + 4.1, hslToRgb(glowHue, 0.54, 0.54), 0.1 + metrics.bassHit * 0.12 + metrics.roomFill * 0.06, 0.76, {softness: 0.44, sweep: 0.06, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addFixture(state, "beam", "wall", timeSeconds * 0.08 + 1.9, hslToRgb(wrapUnit(bandHueA + 0.04), 0.72, 0.62), 0.06 + metrics.leftImpact * 0.24 + metrics.stereoWidth * 0.06, 0.34, {softness: 0.2, sweep: 0.24, vertical: 0.6, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.08) + 4.7, hslToRgb(wrapUnit(bandHueB + 0.1), 0.72, 0.64), 0.06 + metrics.rightImpact * 0.24 + metrics.stereoWidth * 0.06, 0.34, {softness: 0.2, sweep: 0.24, vertical: 0.6, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_NONE});
	applyFixtureGroupsToLightingState(state, 0.34);
};

const discoStorm = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const sweepHue = wrapUnit(0.96 + timeSeconds * (0.24 + metrics.colorMomentum * 0.08));
	addFixture(state, "wash", "ceiling", timeSeconds * 0.92 + metrics.bass * 1.1, hslToRgb(wrapUnit(sweepHue + 0.02), 0.98, 0.6), 0.14 + metrics.roomFill * 0.16 + metrics.bassHit * 0.16, 0.56, {softness: 0.16, sweep: 0.56, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.82) + 1.2, hslToRgb(wrapUnit(sweepHue + 0.46), 0.98, 0.58), 0.16 + metrics.kickGate * 0.28 + metrics.roomFill * 0.12, 0.8, {softness: 0.2, sweep: 0.4, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addFixture(state, "beam", "wall", -(timeSeconds * 1.12) + 1.4, hslToRgb(wrapUnit(sweepHue + 0.22), 1, 0.58), 0.28 + metrics.leftImpact * 0.74 + metrics.motionEnergy * 0.24, 0.3, {softness: 0.05, sweep: 1.3, vertical: 0.64, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", timeSeconds * 1.24 + 4.2, hslToRgb(wrapUnit(sweepHue + 0.72), 1, 0.6), 0.28 + metrics.rightImpact * 0.74 + metrics.motionEnergy * 0.24, 0.3, {softness: 0.05, sweep: 1.3, vertical: 0.64, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", timeSeconds * 0.84 + 0.6, hslToRgb(wrapUnit(sweepHue + 0.1), 0.96, 0.62), 0.16 + metrics.motionEnergy * 0.28 + metrics.transientGate * 0.22, 0.24, {softness: 0.04, sweep: 1.18, vertical: 0.76, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.88) + 5.4, hslToRgb(wrapUnit(sweepHue + 0.58), 0.96, 0.62), 0.16 + metrics.motionEnergy * 0.28 + metrics.transientGate * 0.22, 0.24, {softness: 0.04, sweep: 1.18, vertical: 0.76, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "strobe", "ceiling", timeSeconds * 1.54 + 2.7, hslToRgb(wrapUnit(sweepHue + 0.62), 1, 0.74), 0.18 + metrics.transientGate * 0.46 + metrics.strobeGate * 0.38, 0.22, {softness: 0.03, sweep: 0.72, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addFixture(state, "strobe", "ceiling", -(timeSeconds * 1.36) + 5.1, hslToRgb(wrapUnit(sweepHue + 0.14), 1, 0.74), 0.14 + metrics.transientGate * 0.32 + metrics.strobeGate * 0.28, 0.2, {softness: 0.03, sweep: 0.7, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addFixture(state, "strobe", "wall", timeSeconds * 1.18 + 1.9, hslToRgb(wrapUnit(sweepHue + 0.88), 1, 0.72), 0.1 + metrics.transientGate * 0.3 + metrics.strobeGate * 0.28, 0.2, {softness: 0.03, sweep: 0.86, vertical: 0.72, stereoBias: metrics.stereoBalance >= 0 ? -1 : 1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE});
	addFixture(state, "strobe", "wall", -(timeSeconds * 1.02) + 4.4, hslToRgb(wrapUnit(sweepHue + 0.4), 1, 0.72), 0.08 + metrics.transientGate * 0.24 + metrics.strobeGate * 0.22, 0.18, {softness: 0.03, sweep: 0.74, vertical: 0.64, stereoBias: metrics.stereoBalance >= 0 ? 1 : -1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	applyFixtureGroupsToLightingState(state, 0.12);
};

const neonWash = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const baseHue = wrapUnit(0.08 + timeSeconds * (0.016 + metrics.colorMomentum * 0.03));
	addFixture(state, "wash", "ceiling", timeSeconds * 0.05, hslToRgb(baseHue, 0.96, 0.6), 0.48 + metrics.roomFill * 0.52, 1.28, {softness: 0.42, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "ceiling", -(timeSeconds * 0.04) + 2.2, hslToRgb(wrapUnit(baseHue + 0.18), 0.92, 0.62), 0.46 + metrics.roomFill * 0.44, 1.2, {softness: 0.44, sweep: 0.1, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "ceiling", timeSeconds * 0.03 + 4.1, hslToRgb(wrapUnit(baseHue + 0.34), 0.9, 0.62), 0.32 + metrics.roomFill * 0.28, 1.12, {softness: 0.44, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "floor", timeSeconds * 0.03 + 1.4, hslToRgb(wrapUnit(baseHue + 0.5), 0.86, 0.58), 0.3 + metrics.bassHit * 0.32 + metrics.kickGate * 0.12, 1.2, {softness: 0.42, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.02) + 4.2, hslToRgb(wrapUnit(baseHue + 0.68), 0.74, 0.56), 0.24 + metrics.roomFill * 0.22 + metrics.bassHit * 0.2, 1.08, {softness: 0.44, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addFixture(state, "wash", "wall", timeSeconds * 0.04 + 4.9, hslToRgb(wrapUnit(baseHue + 0.08), 0.86, 0.58), 0.18 + metrics.roomFill * 0.2, 0.92, {softness: 0.34, sweep: 0.18, vertical: 0.54, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "wall", -(timeSeconds * 0.04) + 1.7, hslToRgb(wrapUnit(baseHue + 0.24), 0.82, 0.6), 0.18 + metrics.roomFill * 0.2, 0.92, {softness: 0.34, sweep: 0.18, vertical: 0.54, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "beam", "wall", timeSeconds * 0.06 + 4.3, hslToRgb(wrapUnit(baseHue + 0.8), 0.88, 0.64), 0.04 + metrics.motionEnergy * 0.08 + metrics.stereoWidth * 0.06, 0.36, {softness: 0.22, sweep: 0.14, vertical: 0.52, effectMode: FIXTURE_EFFECT_MODE_NONE});
	applyFixtureGroupsToLightingState(state, 0.42);
};

const stereoChase = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const centerBias = metrics.stereoBalance * 0.42;
	const leftHue = wrapUnit(0.56 + timeSeconds * 0.07 + metrics.colorMomentum * 0.04);
	const rightHue = wrapUnit(leftHue + 0.34);
	addFixture(state, "beam", "wall", timeSeconds * 0.56 + 2.1 + centerBias, hslToRgb(leftHue, 0.98, 0.62), 0.28 + metrics.leftImpact * 1.02 + metrics.stereoWidth * 0.28, 0.32, {softness: 0.05, sweep: 1.34, vertical: 0.62, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.53) + 5.2 + centerBias, hslToRgb(rightHue, 0.98, 0.62), 0.28 + metrics.rightImpact * 1.02 + metrics.stereoWidth * 0.28, 0.32, {softness: 0.05, sweep: 1.34, vertical: 0.62, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.34) + 1.4 + centerBias * 0.5, hslToRgb(wrapUnit(leftHue + 0.08), 0.9, 0.66), 0.14 + metrics.leftImpact * 0.56 + metrics.stereoWidth * 0.08, 0.24, {softness: 0.06, sweep: 0.9, vertical: 0.78, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", timeSeconds * 0.32 + 4.6 + centerBias * 0.5, hslToRgb(wrapUnit(rightHue + 0.08), 0.9, 0.66), 0.14 + metrics.rightImpact * 0.56 + metrics.stereoWidth * 0.08, 0.24, {softness: 0.06, sweep: 0.9, vertical: 0.78, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "wash", "ceiling", timeSeconds * 0.12 + 0.7, hslToRgb(wrapUnit(leftHue + 0.14), 0.72, 0.56), 0.08 + metrics.roomFill * 0.14, 0.62, {softness: 0.2, sweep: 0.14, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.1) + 3.2, hslToRgb(wrapUnit(rightHue + 0.08), 0.72, 0.54), 0.14 + metrics.bassHit * 0.24 + metrics.roomFill * 0.14, 0.76, {softness: 0.2, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addFixture(state, "wash", "floor", timeSeconds * 0.12 + 0.9, hslToRgb(wrapUnit(leftHue + 0.36), 0.76, 0.56), 0.14 + metrics.bassHit * 0.24 + metrics.roomFill * 0.14, 0.76, {softness: 0.2, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addFixture(state, "strobe", "wall", timeSeconds * 0.68 + 1.5, hslToRgb(wrapUnit(leftHue + 0.5), 1, 0.74), 0.1 + metrics.transientGate * 0.3 + metrics.stereoWidth * 0.16, 0.2, {softness: 0.04, sweep: 0.6, vertical: 0.72, stereoBias: -1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addFixture(state, "strobe", "wall", -(timeSeconds * 0.66) + 4.9, hslToRgb(wrapUnit(rightHue + 0.5), 1, 0.74), 0.1 + metrics.transientGate * 0.3 + metrics.stereoWidth * 0.16, 0.2, {softness: 0.04, sweep: 0.6, vertical: 0.72, stereoBias: 1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	applyFixtureGroupsToLightingState(state, 0.12);
};

const pulseStrobe = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const pulseHue = wrapUnit(0.02 + timeSeconds * (0.14 + metrics.colorMomentum * 0.08));
	const strobeHue = wrapUnit(pulseHue + 0.42);
	addFixture(state, "wash", "ceiling", timeSeconds * 0.18, hslToRgb(pulseHue, 0.92, 0.58), 0.08 + metrics.roomFill * 0.1 + metrics.kickGate * 0.08, 0.52, {softness: 0.14, sweep: 0.22, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.16) + 2.2, hslToRgb(wrapUnit(pulseHue + 0.24), 0.84, 0.54), 0.1 + metrics.bassHit * 0.16 + metrics.kickGate * 0.1, 0.62, {softness: 0.16, sweep: 0.18, effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO});
	addFixture(state, "beam", "wall", timeSeconds * 0.78 + 1.4, hslToRgb(wrapUnit(pulseHue + 0.54), 1, 0.64), 0.24 + metrics.leftImpact * 0.62 + metrics.transientGate * 0.28, 0.2, {softness: 0.04, sweep: 1.36, vertical: 0.68, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.74) + 4.8, hslToRgb(wrapUnit(pulseHue + 0.78), 1, 0.64), 0.24 + metrics.rightImpact * 0.62 + metrics.transientGate * 0.28, 0.2, {softness: 0.04, sweep: 1.36, vertical: 0.68, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "strobe", "ceiling", timeSeconds * 1.12 + 0.5, hslToRgb(strobeHue, 1, 0.78), 0.24 + metrics.transientGate * 0.46 + metrics.strobeGate * 0.5, 0.18, {softness: 0.02, sweep: 0.76, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addFixture(state, "strobe", "ceiling", -(timeSeconds * 1.04) + 2.1, hslToRgb(wrapUnit(strobeHue + 0.18), 1, 0.76), 0.18 + metrics.transientGate * 0.38 + metrics.strobeGate * 0.4, 0.16, {softness: 0.02, sweep: 0.72, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addFixture(state, "strobe", "wall", timeSeconds * 0.92 + 3.0, hslToRgb(wrapUnit(strobeHue + 0.3), 1, 0.74), 0.14 + metrics.transientGate * 0.3 + metrics.strobeGate * 0.34, 0.16, {softness: 0.02, sweep: 0.88, vertical: 0.74, stereoBias: metrics.stereoBalance >= 0 ? 1 : -1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE});
	addFixture(state, "strobe", "wall", -(timeSeconds * 0.88) + 1.7, hslToRgb(wrapUnit(strobeHue + 0.56), 1, 0.72), 0.12 + metrics.transientGate * 0.26 + metrics.strobeGate * 0.3, 0.16, {softness: 0.02, sweep: 0.8, vertical: 0.68, stereoBias: metrics.stereoBalance >= 0 ? -1 : 1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE});
	applyFixtureGroupsToLightingState(state, 0.08);
};

const lightingPresetDefinitions = [
	{
		name: formatFunctionLabel(auroraDrift.name),
		description: "Slow aurora-like ceiling light bands with cool floor glow",
		buildState: auroraDrift
	},
	{
		name: formatFunctionLabel(discoStorm.name),
		description: "Chaotic mixed beams with ceiling hits and cutout wall strobes",
		buildState: discoStorm
	},
	{
		name: formatFunctionLabel(neonWash.name),
		description: "Massive ceiling-wall color fill with soft floor underglow",
		buildState: neonWash
	},
	{
		name: formatFunctionLabel(stereoChase.name),
		description: "Hard mirrored side runners with split-color floor chase",
		buildState: stereoChase
	},
	{
		name: formatFunctionLabel(pulseStrobe.name),
		description: "Dark peak-heavy rig with sharp ceiling hits and wall cut strobes",
		buildState: pulseStrobe
	}
];
