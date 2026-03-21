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
		stereoBias: options.stereoBias
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
	const baseHue = wrapUnit(0.58 + timeSeconds * 0.008 + metrics.colorMomentum * 0.03);
	const fillHue = wrapUnit(baseHue + 0.18 + metrics.bassHit * 0.03);
	const accentHue = wrapUnit(baseHue + 0.54 + metrics.transient * 0.04);
	addFixture(state, "wash", "ceiling", timeSeconds * 0.16, hslToRgb(baseHue, 0.82, 0.58), 0.34 + metrics.roomFill * 0.42 + metrics.kickGate * 0.14, 0.84, {softness: 0.24, sweep: 0.22});
	addFixture(state, "wash", "floor", timeSeconds * -0.11 + 2.4, hslToRgb(fillHue, 0.76, 0.56), 0.22 + metrics.bassHit * 0.38 + metrics.roomFill * 0.12, 0.92, {softness: 0.28, sweep: 0.16});
	addFixture(state, "beam", "wall", timeSeconds * 0.23 + 1.6, hslToRgb(wrapUnit(baseHue + 0.08), 0.92, 0.6), 0.18 + metrics.leftImpact * 0.44 + metrics.stereoWidth * 0.12, 0.42, {softness: 0.12, sweep: 0.44, vertical: 0.58, stereoBias: -1});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.21) + 5.1, hslToRgb(wrapUnit(baseHue + 0.34), 0.92, 0.62), 0.18 + metrics.rightImpact * 0.44 + metrics.stereoWidth * 0.12, 0.42, {softness: 0.12, sweep: 0.44, vertical: 0.58, stereoBias: 1});
	addFixture(state, "strobe", "ceiling", timeSeconds * 0.28 + 0.9, hslToRgb(accentHue, 0.98, 0.7), 0.08 + metrics.transientGate * 0.26 + metrics.strobeGate * 0.18, 0.32, {softness: 0.08, sweep: 0.3, strobeAmount: metrics.strobeGate});
	applyFixtureGroupsToLightingState(state, 0.22);
};

const discoStorm = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const sweepHue = wrapUnit(0.96 + timeSeconds * (0.19 + metrics.colorMomentum * 0.06));
	addFixture(state, "wash", "ceiling", timeSeconds * 0.82 + metrics.bass * 0.9, hslToRgb(wrapUnit(sweepHue + 0.02), 0.98, 0.6), 0.24 + metrics.roomFill * 0.22 + metrics.bassHit * 0.2, 0.7, {softness: 0.18, sweep: 0.38});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.74) + 1.2, hslToRgb(wrapUnit(sweepHue + 0.46), 0.96, 0.58), 0.16 + metrics.kickGate * 0.34 + metrics.roomFill * 0.18, 0.82, {softness: 0.24, sweep: 0.28});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.91) + 1.9, hslToRgb(wrapUnit(sweepHue + 0.28), 0.98, 0.58), 0.2 + metrics.leftImpact * 0.4 + metrics.motionEnergy * 0.14, 0.34, {softness: 0.08, sweep: 0.8, vertical: 0.64, stereoBias: -1});
	addFixture(state, "beam", "wall", timeSeconds * 1.14 + 4.0, hslToRgb(wrapUnit(sweepHue + 0.8), 0.98, 0.6), 0.2 + metrics.rightImpact * 0.4 + metrics.motionEnergy * 0.14, 0.34, {softness: 0.08, sweep: 0.8, vertical: 0.64, stereoBias: 1});
	addFixture(state, "strobe", "ceiling", timeSeconds * 1.36 + 2.7, hslToRgb(wrapUnit(sweepHue + 0.62), 1, 0.72), 0.12 + metrics.transientGate * 0.38 + metrics.strobeGate * 0.26, 0.26, {softness: 0.05, sweep: 0.54, strobeAmount: metrics.strobeGate});
	applyFixtureGroupsToLightingState(state, 0.18);
};

const neonWash = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const baseHue = wrapUnit(0.08 + timeSeconds * (0.022 + metrics.colorMomentum * 0.04));
	addFixture(state, "wash", "ceiling", timeSeconds * 0.09, hslToRgb(baseHue, 0.9, 0.58), 0.36 + metrics.roomFill * 0.44, 1.02, {softness: 0.3, sweep: 0.18});
	addFixture(state, "wash", "ceiling", -(timeSeconds * 0.07) + 2.8, hslToRgb(wrapUnit(baseHue + 0.22), 0.88, 0.6), 0.28 + metrics.roomFill * 0.36, 0.92, {softness: 0.28, sweep: 0.18});
	addFixture(state, "wash", "floor", timeSeconds * 0.05 + 1.4, hslToRgb(wrapUnit(baseHue + 0.52), 0.78, 0.56), 0.2 + metrics.bassHit * 0.34 + metrics.kickGate * 0.16, 1.06, {softness: 0.34, sweep: 0.12});
	addFixture(state, "beam", "wall", timeSeconds * 0.12 + 4.3, hslToRgb(wrapUnit(baseHue + 0.78), 0.92, 0.64), 0.12 + metrics.motionEnergy * 0.22 + metrics.stereoWidth * 0.16, 0.46, {softness: 0.16, sweep: 0.26, vertical: 0.52});
	applyFixtureGroupsToLightingState(state, 0.26);
};

const stereoChase = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const centerBias = metrics.stereoBalance * 0.42;
	const leftHue = wrapUnit(0.56 + timeSeconds * 0.07 + metrics.colorMomentum * 0.04);
	const rightHue = wrapUnit(leftHue + 0.34);
	addFixture(state, "beam", "wall", timeSeconds * 0.42 + 2.3 + centerBias, hslToRgb(leftHue, 0.94, 0.62), 0.18 + metrics.leftImpact * 0.52 + metrics.stereoWidth * 0.18, 0.36, {softness: 0.08, sweep: 0.94, vertical: 0.62, stereoBias: -1});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.39) + 5.0 + centerBias, hslToRgb(rightHue, 0.94, 0.62), 0.18 + metrics.rightImpact * 0.52 + metrics.stereoWidth * 0.18, 0.36, {softness: 0.08, sweep: 0.94, vertical: 0.62, stereoBias: 1});
	addFixture(state, "wash", "ceiling", timeSeconds * 0.18 + 0.7, hslToRgb(wrapUnit(leftHue + 0.12), 0.8, 0.56), 0.2 + metrics.roomFill * 0.24, 0.74, {softness: 0.2, sweep: 0.24});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.16) + 3.2, hslToRgb(wrapUnit(rightHue + 0.08), 0.78, 0.54), 0.16 + metrics.bassHit * 0.22 + metrics.roomFill * 0.16, 0.8, {softness: 0.24, sweep: 0.2});
	addFixture(state, "strobe", "wall", timeSeconds * 0.52 + 1.5, hslToRgb(wrapUnit(leftHue + 0.5), 1, 0.72), 0.06 + metrics.transientGate * 0.26 + metrics.stereoWidth * 0.12, 0.24, {softness: 0.06, sweep: 0.42, vertical: 0.7, strobeAmount: metrics.strobeGate});
	applyFixtureGroupsToLightingState(state, 0.2);
};

const pulseStrobe = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const pulseHue = wrapUnit(0.02 + timeSeconds * (0.14 + metrics.colorMomentum * 0.08));
	addFixture(state, "wash", "ceiling", timeSeconds * 0.28, hslToRgb(pulseHue, 0.96, 0.6), 0.24 + metrics.roomFill * 0.28 + metrics.kickGate * 0.12, 0.76, {softness: 0.18, sweep: 0.36});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.24) + 2.2, hslToRgb(wrapUnit(pulseHue + 0.28), 0.88, 0.56), 0.18 + metrics.bassHit * 0.3 + metrics.kickGate * 0.16, 0.86, {softness: 0.22, sweep: 0.32});
	addFixture(state, "beam", "wall", timeSeconds * 0.67 + 1.4, hslToRgb(wrapUnit(pulseHue + 0.54), 0.98, 0.64), 0.18 + metrics.leftImpact * 0.3 + metrics.transientGate * 0.18, 0.28, {softness: 0.06, sweep: 1.02, vertical: 0.68, stereoBias: -1});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.62) + 4.8, hslToRgb(wrapUnit(pulseHue + 0.78), 0.98, 0.64), 0.18 + metrics.rightImpact * 0.3 + metrics.transientGate * 0.18, 0.28, {softness: 0.06, sweep: 1.02, vertical: 0.68, stereoBias: 1});
	addFixture(state, "strobe", "ceiling", timeSeconds * 0.94 + 0.5, hslToRgb(wrapUnit(pulseHue + 0.42), 1, 0.76), 0.16 + metrics.transientGate * 0.34 + metrics.strobeGate * 0.4, 0.22, {softness: 0.04, sweep: 0.62, strobeAmount: metrics.strobeGate});
	applyFixtureGroupsToLightingState(state, 0.17);
};

const lightingPresetDefinitions = [
	{
		name: formatFunctionLabel(auroraDrift.name),
		description: "Slow hybrid wash with stereo wall accents",
		buildState: auroraDrift
	},
	{
		name: formatFunctionLabel(discoStorm.name),
		description: "Fast colorful disco with hard transient accents",
		buildState: discoStorm
	},
	{
		name: formatFunctionLabel(neonWash.name),
		description: "Broad room-filling neon wash",
		buildState: neonWash
	},
	{
		name: formatFunctionLabel(stereoChase.name),
		description: "Stereo-driven wall chase and side beams",
		buildState: stereoChase
	},
	{
		name: formatFunctionLabel(pulseStrobe.name),
		description: "Beat-heavy club pulses with controlled strobe peaks",
		buildState: pulseStrobe
	}
];
