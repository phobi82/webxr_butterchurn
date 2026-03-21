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
	addFixture(state, "wash", "ceiling", timeSeconds * 0.06 + 0.18, hslToRgb(bandHueA, 0.88, 0.56), 0.38 + metrics.roomFill * 0.28, 1.18, {softness: 0.42, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_SHUTTERS});
	addFixture(state, "wash", "ceiling", -(timeSeconds * 0.05) + 0.72, hslToRgb(bandHueB, 0.82, 0.6), 0.34 + metrics.roomFill * 0.24, 1.12, {softness: 0.44, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_SHUTTERS});
	addFixture(state, "wash", "ceiling", timeSeconds * 0.04 + 1.34, hslToRgb(bandHueC, 0.76, 0.62), 0.28 + metrics.roomFill * 0.22, 1.04, {softness: 0.46, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_SHUTTERS});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.03) + 4.1, hslToRgb(glowHue, 0.54, 0.54), 0.1 + metrics.bassHit * 0.12 + metrics.roomFill * 0.06, 0.76, {softness: 0.44, sweep: 0.06, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "beam", "wall", timeSeconds * 0.08 + 1.9, hslToRgb(wrapUnit(bandHueA + 0.04), 0.72, 0.62), 0.06 + metrics.leftImpact * 0.24 + metrics.stereoWidth * 0.06, 0.34, {softness: 0.2, sweep: 0.24, vertical: 0.6, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.08) + 4.7, hslToRgb(wrapUnit(bandHueB + 0.1), 0.72, 0.64), 0.06 + metrics.rightImpact * 0.24 + metrics.stereoWidth * 0.06, 0.34, {softness: 0.2, sweep: 0.24, vertical: 0.6, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_NONE});
	applyFixtureGroupsToLightingState(state, 0.34);
};

const discoStorm = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const sweepHue = wrapUnit(0.96 + timeSeconds * (0.24 + metrics.colorMomentum * 0.08));
	addFixture(state, "wash", "ceiling", timeSeconds * 0.92 + metrics.bass * 1.1, hslToRgb(wrapUnit(sweepHue + 0.02), 0.98, 0.6), 0.18 + metrics.roomFill * 0.18 + metrics.bassHit * 0.18, 0.62, {softness: 0.18, sweep: 0.48, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.82) + 1.2, hslToRgb(wrapUnit(sweepHue + 0.46), 0.98, 0.58), 0.14 + metrics.kickGate * 0.26 + metrics.roomFill * 0.12, 0.72, {softness: 0.22, sweep: 0.34, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "beam", "wall", -(timeSeconds * 1.12) + 1.4, hslToRgb(wrapUnit(sweepHue + 0.22), 1, 0.58), 0.26 + metrics.leftImpact * 0.7 + metrics.motionEnergy * 0.2, 0.32, {softness: 0.06, sweep: 1.2, vertical: 0.64, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", timeSeconds * 1.24 + 4.2, hslToRgb(wrapUnit(sweepHue + 0.72), 1, 0.6), 0.26 + metrics.rightImpact * 0.7 + metrics.motionEnergy * 0.2, 0.32, {softness: 0.06, sweep: 1.2, vertical: 0.64, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", timeSeconds * 0.84 + 0.6, hslToRgb(wrapUnit(sweepHue + 0.1), 0.96, 0.62), 0.18 + metrics.motionEnergy * 0.24 + metrics.transientGate * 0.18, 0.28, {softness: 0.05, sweep: 1.06, vertical: 0.76, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.88) + 5.4, hslToRgb(wrapUnit(sweepHue + 0.58), 0.96, 0.62), 0.18 + metrics.motionEnergy * 0.24 + metrics.transientGate * 0.18, 0.28, {softness: 0.05, sweep: 1.06, vertical: 0.76, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "strobe", "ceiling", timeSeconds * 1.54 + 2.7, hslToRgb(wrapUnit(sweepHue + 0.62), 1, 0.74), 0.16 + metrics.transientGate * 0.42 + metrics.strobeGate * 0.34, 0.24, {softness: 0.04, sweep: 0.66, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addFixture(state, "strobe", "wall", timeSeconds * 1.18 + 1.9, hslToRgb(wrapUnit(sweepHue + 0.88), 1, 0.72), 0.08 + metrics.transientGate * 0.28 + metrics.strobeGate * 0.24, 0.22, {softness: 0.04, sweep: 0.74, vertical: 0.72, stereoBias: metrics.stereoBalance >= 0 ? -1 : 1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE});
	applyFixtureGroupsToLightingState(state, 0.14);
};

const neonWash = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const baseHue = wrapUnit(0.08 + timeSeconds * (0.016 + metrics.colorMomentum * 0.03));
	addFixture(state, "wash", "ceiling", timeSeconds * 0.05, hslToRgb(baseHue, 0.96, 0.6), 0.46 + metrics.roomFill * 0.48, 1.24, {softness: 0.4, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "ceiling", -(timeSeconds * 0.04) + 2.2, hslToRgb(wrapUnit(baseHue + 0.18), 0.92, 0.62), 0.42 + metrics.roomFill * 0.4, 1.18, {softness: 0.42, sweep: 0.12, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "floor", timeSeconds * 0.03 + 1.4, hslToRgb(wrapUnit(baseHue + 0.5), 0.86, 0.58), 0.28 + metrics.bassHit * 0.28 + metrics.kickGate * 0.1, 1.18, {softness: 0.42, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.02) + 4.2, hslToRgb(wrapUnit(baseHue + 0.68), 0.74, 0.56), 0.22 + metrics.roomFill * 0.18 + metrics.bassHit * 0.18, 1.04, {softness: 0.44, sweep: 0.08, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "beam", "wall", timeSeconds * 0.06 + 4.3, hslToRgb(wrapUnit(baseHue + 0.8), 0.88, 0.64), 0.06 + metrics.motionEnergy * 0.14 + metrics.stereoWidth * 0.1, 0.42, {softness: 0.2, sweep: 0.18, vertical: 0.52, effectMode: FIXTURE_EFFECT_MODE_NONE});
	applyFixtureGroupsToLightingState(state, 0.34);
};

const stereoChase = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const centerBias = metrics.stereoBalance * 0.42;
	const leftHue = wrapUnit(0.56 + timeSeconds * 0.07 + metrics.colorMomentum * 0.04);
	const rightHue = wrapUnit(leftHue + 0.34);
	addFixture(state, "beam", "wall", timeSeconds * 0.56 + 2.1 + centerBias, hslToRgb(leftHue, 0.98, 0.62), 0.24 + metrics.leftImpact * 0.94 + metrics.stereoWidth * 0.24, 0.34, {softness: 0.06, sweep: 1.24, vertical: 0.62, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.53) + 5.2 + centerBias, hslToRgb(rightHue, 0.98, 0.62), 0.24 + metrics.rightImpact * 0.94 + metrics.stereoWidth * 0.24, 0.34, {softness: 0.06, sweep: 1.24, vertical: 0.62, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.34) + 1.4 + centerBias * 0.5, hslToRgb(wrapUnit(leftHue + 0.08), 0.9, 0.66), 0.12 + metrics.leftImpact * 0.5, 0.28, {softness: 0.08, sweep: 0.78, vertical: 0.76, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", timeSeconds * 0.32 + 4.6 + centerBias * 0.5, hslToRgb(wrapUnit(rightHue + 0.08), 0.9, 0.66), 0.12 + metrics.rightImpact * 0.5, 0.28, {softness: 0.08, sweep: 0.78, vertical: 0.76, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "wash", "ceiling", timeSeconds * 0.12 + 0.7, hslToRgb(wrapUnit(leftHue + 0.14), 0.72, 0.56), 0.12 + metrics.roomFill * 0.18, 0.68, {softness: 0.22, sweep: 0.18, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.1) + 3.2, hslToRgb(wrapUnit(rightHue + 0.08), 0.72, 0.54), 0.1 + metrics.bassHit * 0.18 + metrics.roomFill * 0.12, 0.72, {softness: 0.22, sweep: 0.16, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "strobe", "wall", timeSeconds * 0.68 + 1.5, hslToRgb(wrapUnit(leftHue + 0.5), 1, 0.74), 0.08 + metrics.transientGate * 0.28 + metrics.stereoWidth * 0.14, 0.22, {softness: 0.05, sweep: 0.54, vertical: 0.72, stereoBias: metrics.stereoBalance >= 0 ? -1 : 1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	applyFixtureGroupsToLightingState(state, 0.16);
};

const pulseStrobe = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const pulseHue = wrapUnit(0.02 + timeSeconds * (0.14 + metrics.colorMomentum * 0.08));
	const strobeHue = wrapUnit(pulseHue + 0.42);
	addFixture(state, "wash", "ceiling", timeSeconds * 0.18, hslToRgb(pulseHue, 0.92, 0.58), 0.14 + metrics.roomFill * 0.18 + metrics.kickGate * 0.1, 0.62, {softness: 0.16, sweep: 0.28, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.16) + 2.2, hslToRgb(wrapUnit(pulseHue + 0.24), 0.84, 0.54), 0.12 + metrics.bassHit * 0.18 + metrics.kickGate * 0.12, 0.72, {softness: 0.18, sweep: 0.24, effectMode: FIXTURE_EFFECT_MODE_NONE});
	addFixture(state, "beam", "wall", timeSeconds * 0.78 + 1.4, hslToRgb(wrapUnit(pulseHue + 0.54), 1, 0.64), 0.2 + metrics.leftImpact * 0.58 + metrics.transientGate * 0.24, 0.24, {softness: 0.05, sweep: 1.28, vertical: 0.68, stereoBias: -1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.74) + 4.8, hslToRgb(wrapUnit(pulseHue + 0.78), 1, 0.64), 0.2 + metrics.rightImpact * 0.58 + metrics.transientGate * 0.24, 0.24, {softness: 0.05, sweep: 1.28, vertical: 0.68, stereoBias: 1, effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER});
	addFixture(state, "strobe", "ceiling", timeSeconds * 1.12 + 0.5, hslToRgb(strobeHue, 1, 0.78), 0.22 + metrics.transientGate * 0.42 + metrics.strobeGate * 0.46, 0.2, {softness: 0.03, sweep: 0.74, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addFixture(state, "strobe", "ceiling", -(timeSeconds * 1.04) + 2.1, hslToRgb(wrapUnit(strobeHue + 0.18), 1, 0.76), 0.16 + metrics.transientGate * 0.34 + metrics.strobeGate * 0.36, 0.18, {softness: 0.03, sweep: 0.68, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT});
	addFixture(state, "strobe", "wall", timeSeconds * 0.92 + 3.0, hslToRgb(wrapUnit(strobeHue + 0.3), 1, 0.74), 0.1 + metrics.transientGate * 0.26 + metrics.strobeGate * 0.3, 0.18, {softness: 0.03, sweep: 0.84, vertical: 0.74, stereoBias: metrics.stereoBalance >= 0 ? 1 : -1, strobeAmount: metrics.strobeGate, effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE});
	applyFixtureGroupsToLightingState(state, 0.12);
};

const lightingPresetDefinitions = [
	{
		name: formatFunctionLabel(auroraDrift.name),
		description: "Slow aurora-like ceiling light bands with cool floor glow",
		buildState: auroraDrift
	},
	{
		name: formatFunctionLabel(discoStorm.name),
		description: "Busy disco rig with mixed beams and hard strobe hits",
		buildState: discoStorm
	},
	{
		name: formatFunctionLabel(neonWash.name),
		description: "Huge saturated room wash with minimal beam detail",
		buildState: neonWash
	},
	{
		name: formatFunctionLabel(stereoChase.name),
		description: "Aggressive left-right wall chase with mirrored side beams",
		buildState: stereoChase
	},
	{
		name: formatFunctionLabel(pulseStrobe.name),
		description: "Peak-heavy strobe rig with narrow beams and sharp hits",
		buildState: pulseStrobe
	}
];
