// Isolated single-effect presets for TestLab.html.

const buildTestLabSoftWash = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hue = wrapUnit(0.54 + timeSeconds * 0.03 + metrics.colorMomentum * 0.03);
	addFixture(state, "wash", "ceiling", timeSeconds * 0.06, hslToRgb(hue, 0.86, 0.6), 0.54 + metrics.roomFill * 0.26, 1.12, {
		softness: 0.34,
		sweep: 0.08,
		effectMode: FIXTURE_EFFECT_MODE_NONE
	});
	applyFixtureGroupsToLightingState(state, 0.28);
};

const buildTestLabShutters = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hue = wrapUnit(0.96 + timeSeconds * 0.04 + metrics.colorMomentum * 0.03);
	addFixture(state, "wash", "ceiling", timeSeconds * 0.08, hslToRgb(hue, 0.92, 0.62), 0.56 + metrics.roomFill * 0.22, 1.02, {
		softness: 0.22,
		sweep: 0.14,
		effectMode: FIXTURE_EFFECT_MODE_SHUTTERS
	});
	applyFixtureGroupsToLightingState(state, 0.22);
};

const buildTestLabEdgeRunner = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const leftHue = wrapUnit(0.58 + timeSeconds * 0.06);
	const rightHue = wrapUnit(leftHue + 0.34);
	addFixture(state, "beam", "wall", timeSeconds * 0.48 + 1.8, hslToRgb(leftHue, 0.98, 0.62), 0.36 + metrics.leftImpact * 0.82 + metrics.stereoWidth * 0.18, 0.28, {
		softness: 0.05,
		sweep: 1.36,
		vertical: 0.7,
		stereoBias: -1,
		effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER
	});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.46) + 4.9, hslToRgb(rightHue, 0.98, 0.62), 0.36 + metrics.rightImpact * 0.82 + metrics.stereoWidth * 0.18, 0.28, {
		softness: 0.05,
		sweep: 1.36,
		vertical: 0.7,
		stereoBias: 1,
		effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER
	});
	applyFixtureGroupsToLightingState(state, 0.16);
};

const buildTestLabSilhouetteCut = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hue = wrapUnit(0.1 + timeSeconds * 0.08);
	addFixture(state, "strobe", "wall", timeSeconds * 0.44 + 1.2, hslToRgb(hue, 1, 0.72), 0.28 + metrics.transientGate * 0.44 + metrics.strobeGate * 0.26, 0.24, {
		softness: 0.04,
		sweep: 0.72,
		vertical: 0.7,
		strobeAmount: metrics.strobeGate,
		effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE
	});
	applyFixtureGroupsToLightingState(state, 0.1);
};

const buildTestLabRoomWindowBeat = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hue = wrapUnit(0.34 + timeSeconds * 0.08);
	addFixture(state, "strobe", "wall", timeSeconds * 0.52 + 1.4, hslToRgb(hue, 0.98, 0.68), 0.26 + metrics.beatPulse * 0.38 + metrics.strobeGate * 0.24, 0.24, {
		softness: 0.04,
		sweep: 0.76,
		vertical: 0.68,
		strobeAmount: metrics.strobeGate,
		effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT
	});
	applyFixtureGroupsToLightingState(state, 0.1);
};

const buildTestLabAuroraCurtain = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const bandHueA = wrapUnit(0.34 + timeSeconds * 0.004 + metrics.colorMomentum * 0.012);
	const bandHueB = wrapUnit(bandHueA + 0.1);
	const bandHueC = wrapUnit(bandHueA + 0.22);
	addFixture(state, "wash", "ceiling", timeSeconds * 0.06 + 0.18, hslToRgb(bandHueA, 0.88, 0.56), 0.42 + metrics.roomFill * 0.28, 0.82, {
		softness: 0.28,
		sweep: 0.18,
		effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN
	});
	addFixture(state, "wash", "ceiling", -(timeSeconds * 0.05) + 0.72, hslToRgb(bandHueB, 0.82, 0.6), 0.38 + metrics.roomFill * 0.26, 0.76, {
		softness: 0.3,
		sweep: 0.18,
		effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN
	});
	addFixture(state, "wash", "ceiling", timeSeconds * 0.04 + 1.34, hslToRgb(bandHueC, 0.76, 0.62), 0.34 + metrics.roomFill * 0.22, 0.7, {
		softness: 0.32,
		sweep: 0.16,
		effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN
	});
	applyFixtureGroupsToLightingState(state, 0.24);
};

const buildTestLabFloorHalo = function(state, timeSeconds, audioMetrics) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hueA = wrapUnit(0.98 + timeSeconds * 0.04);
	const hueB = wrapUnit(hueA + 0.42);
	addFixture(state, "wash", "floor", timeSeconds * 0.16 + 0.8, hslToRgb(hueA, 0.9, 0.58), 0.24 + metrics.bassHit * 0.34 + metrics.kickGate * 0.16, 0.96, {
		softness: 0.34,
		sweep: 0.12,
		effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO
	});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.14) + 3.1, hslToRgb(hueB, 0.88, 0.58), 0.24 + metrics.bassHit * 0.34 + metrics.kickGate * 0.16, 0.92, {
		softness: 0.34,
		sweep: 0.12,
		effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO
	});
	applyFixtureGroupsToLightingState(state, 0.18);
};

const testLabLightingPresetDefinitions = [
	{
		name: "Soft Wash",
		description: "Isolated broad wash for neutral room-fill evaluation",
		buildState: buildTestLabSoftWash
	},
	{
		name: "Shutters",
		description: "Isolated shuttered wash for sliced internal structure evaluation",
		buildState: buildTestLabShutters
	},
	{
		name: "Edge Runner",
		description: "Isolated side-lane runner beams for directional wall-motion evaluation",
		buildState: buildTestLabEdgeRunner
	},
	{
		name: "Silhouette Cut",
		description: "Isolated hard reveal cut for room-opening evaluation",
		buildState: buildTestLabSilhouetteCut
	},
	{
		name: "Room Window Beat",
		description: "Isolated beat-window reveal for rhythmic cutout evaluation",
		buildState: buildTestLabRoomWindowBeat
	},
	{
		name: "Aurora Curtain",
		description: "Isolated aurora ceiling bands for ribbon readability evaluation",
		buildState: buildTestLabAuroraCurtain
	},
	{
		name: "Floor Halo",
		description: "Isolated floor underglow for halo visibility evaluation",
		buildState: buildTestLabFloorHalo
	}
];
