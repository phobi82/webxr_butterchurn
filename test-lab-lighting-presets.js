// Isolated single-effect presets for TestLab.html.

const buildTestLabSoftWash = function(state, timeSeconds, audioMetrics, contextKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hueA = wrapUnit(0.54 + timeSeconds * 0.02 + metrics.colorMomentum * 0.03);
	const hueB = wrapUnit(hueA + 0.06);
	if (contextKey === "wall") {
		addFixture(state, "wash", "wall", timeSeconds * 0.04 + 1.18, hslToRgb(hueA, 0.8, 0.58), 0.22 + metrics.roomFill * 0.14, 1.02, {
			softness: 0.38,
			sweep: 0.16,
			vertical: 0.56,
			stereoBias: -1,
			effectMode: FIXTURE_EFFECT_MODE_NONE
		});
		addFixture(state, "wash", "wall", -(timeSeconds * 0.035) + 4.72, hslToRgb(hueB, 0.74, 0.62), 0.22 + metrics.roomFill * 0.14, 1.02, {
			softness: 0.4,
			sweep: 0.16,
			vertical: 0.56,
			stereoBias: 1,
			effectMode: FIXTURE_EFFECT_MODE_NONE
		});
		applyFixtureGroupsToLightingState(state, 0.2);
		return;
	}
	if (contextKey === "floor") {
		addFixture(state, "wash", "floor", timeSeconds * 0.04 + 0.62, hslToRgb(hueA, 0.78, 0.56), 0.2 + metrics.bassHit * 0.18 + metrics.roomFill * 0.1, 1.1, {
			softness: 0.42,
			sweep: 0.08,
			effectMode: FIXTURE_EFFECT_MODE_NONE
		});
		addFixture(state, "wash", "floor", -(timeSeconds * 0.03) + 3.46, hslToRgb(hueB, 0.72, 0.6), 0.18 + metrics.bassHit * 0.16 + metrics.roomFill * 0.1, 1.02, {
			softness: 0.44,
			sweep: 0.08,
			effectMode: FIXTURE_EFFECT_MODE_NONE
		});
		applyFixtureGroupsToLightingState(state, 0.18);
		return;
	}
	addFixture(state, "wash", "ceiling", timeSeconds * 0.04 - 0.22, hslToRgb(hueA, 0.82, 0.58), 0.34 + metrics.roomFill * 0.18, 1.2, {
		softness: 0.4,
		sweep: 0.12,
		effectMode: FIXTURE_EFFECT_MODE_NONE
	});
	addFixture(state, "wash", "ceiling", -(timeSeconds * 0.035) + 0.34, hslToRgb(hueB, 0.76, 0.62), 0.3 + metrics.roomFill * 0.16, 1.08, {
		softness: 0.42,
		sweep: 0.1,
		effectMode: FIXTURE_EFFECT_MODE_NONE
	});
	applyFixtureGroupsToLightingState(state, 0.28);
};

const buildTestLabShutters = function(state, timeSeconds, audioMetrics, contextKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hueA = wrapUnit(0.96 + timeSeconds * 0.035 + metrics.colorMomentum * 0.03);
	const hueB = wrapUnit(hueA + 0.09);
	if (contextKey === "wall") {
		addFixture(state, "wash", "wall", timeSeconds * 0.06 + 1.1, hslToRgb(hueA, 0.9, 0.6), 0.24 + metrics.roomFill * 0.14, 0.88, {
			softness: 0.24,
			sweep: 0.22,
			vertical: 0.58,
			stereoBias: -1,
			effectMode: FIXTURE_EFFECT_MODE_SHUTTERS
		});
		addFixture(state, "wash", "wall", -(timeSeconds * 0.05) + 4.8, hslToRgb(hueB, 0.82, 0.62), 0.22 + metrics.roomFill * 0.12, 0.82, {
			softness: 0.24,
			sweep: 0.2,
			vertical: 0.58,
			stereoBias: 1,
			effectMode: FIXTURE_EFFECT_MODE_SHUTTERS
		});
		applyFixtureGroupsToLightingState(state, 0.18);
		return;
	}
	addFixture(state, "wash", "ceiling", timeSeconds * 0.06 - 0.18, hslToRgb(hueA, 0.92, 0.6), 0.34 + metrics.roomFill * 0.16, 0.96, {
		softness: 0.26,
		sweep: 0.18,
		effectMode: FIXTURE_EFFECT_MODE_SHUTTERS
	});
	addFixture(state, "wash", "ceiling", -(timeSeconds * 0.05) + 0.42, hslToRgb(hueB, 0.84, 0.62), 0.28 + metrics.roomFill * 0.14, 0.84, {
		softness: 0.28,
		sweep: 0.16,
		effectMode: FIXTURE_EFFECT_MODE_SHUTTERS
	});
	applyFixtureGroupsToLightingState(state, 0.22);
};

const buildTestLabEdgeRunner = function(state, timeSeconds, audioMetrics, contextKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const leftHue = wrapUnit(0.58 + timeSeconds * 0.06);
	const rightHue = wrapUnit(leftHue + 0.34);
	if (contextKey === "ceiling") {
		addFixture(state, "beam", "ceiling", timeSeconds * 0.44 + 0.9, hslToRgb(leftHue, 0.98, 0.62), 0.24 + metrics.leftImpact * 0.5 + metrics.motionEnergy * 0.14, 0.26, {
			softness: 0.04,
			sweep: 1.22,
			effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER
		});
		addFixture(state, "beam", "ceiling", -(timeSeconds * 0.42) + 3.8, hslToRgb(rightHue, 0.98, 0.62), 0.24 + metrics.rightImpact * 0.5 + metrics.motionEnergy * 0.14, 0.26, {
			softness: 0.04,
			sweep: 1.22,
			effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER
		});
		applyFixtureGroupsToLightingState(state, 0.12);
		return;
	}
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

const buildTestLabSilhouetteCut = function(state, timeSeconds, audioMetrics, contextKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hue = wrapUnit(0.1 + timeSeconds * 0.08);
	addFixture(state, "strobe", contextKey === "ceiling" ? "ceiling" : "wall", timeSeconds * 0.44 + 1.2, hslToRgb(hue, 1, 0.72), 0.28 + metrics.transientGate * 0.44 + metrics.strobeGate * 0.26, 0.24, {
		softness: 0.04,
		sweep: contextKey === "ceiling" ? 0.66 : 0.72,
		vertical: contextKey === "ceiling" ? 0.55 : 0.7,
		strobeAmount: metrics.strobeGate,
		effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE
	});
	applyFixtureGroupsToLightingState(state, 0.1);
};

const buildTestLabRoomWindowBeat = function(state, timeSeconds, audioMetrics, contextKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hue = wrapUnit(0.34 + timeSeconds * 0.08);
	addFixture(state, "strobe", contextKey === "ceiling" ? "ceiling" : "wall", timeSeconds * 0.52 + 1.4, hslToRgb(hue, 0.98, 0.68), 0.26 + metrics.beatPulse * 0.38 + metrics.strobeGate * 0.24, 0.24, {
		softness: 0.04,
		sweep: contextKey === "ceiling" ? 0.7 : 0.76,
		vertical: contextKey === "ceiling" ? 0.56 : 0.68,
		strobeAmount: metrics.strobeGate,
		effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT
	});
	applyFixtureGroupsToLightingState(state, 0.1);
};

const buildTestLabAuroraCurtain = function(state, timeSeconds, audioMetrics, contextKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const bandHueA = wrapUnit(0.34 + timeSeconds * 0.004 + metrics.colorMomentum * 0.012);
	const bandHueB = wrapUnit(bandHueA + 0.1);
	const bandHueC = wrapUnit(bandHueA + 0.22);
	if (contextKey === "wall") {
		addFixture(state, "wash", "wall", timeSeconds * 0.06 + 1.1, hslToRgb(bandHueA, 0.88, 0.56), 0.26 + metrics.roomFill * 0.18, 0.74, {
			softness: 0.24,
			sweep: 0.2,
			vertical: 0.54,
			stereoBias: -1,
			effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN
		});
		addFixture(state, "wash", "wall", -(timeSeconds * 0.05) + 4.76, hslToRgb(bandHueB, 0.82, 0.6), 0.22 + metrics.roomFill * 0.16, 0.7, {
			softness: 0.24,
			sweep: 0.18,
			vertical: 0.54,
			stereoBias: 1,
			effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN
		});
		addFixture(state, "wash", "wall", timeSeconds * 0.04 + 2.96, hslToRgb(bandHueC, 0.76, 0.62), 0.18 + metrics.roomFill * 0.14, 0.64, {
			softness: 0.24,
			sweep: 0.16,
			vertical: 0.62,
			effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN
		});
		applyFixtureGroupsToLightingState(state, 0.18);
		return;
	}
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

const buildTestLabFloorHalo = function(state, timeSeconds, audioMetrics, contextKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hueA = wrapUnit(0.98 + timeSeconds * 0.04);
	const hueB = wrapUnit(hueA + 0.42);
	addFixture(state, "wash", "floor", timeSeconds * 0.16 + 0.8 + (contextKey === "directional" ? -0.42 : 0), hslToRgb(hueA, 0.9, 0.58), 0.24 + metrics.bassHit * 0.34 + metrics.kickGate * 0.16, contextKey === "directional" ? 0.84 : 0.96, {
		softness: contextKey === "directional" ? 0.28 : 0.34,
		sweep: 0.12,
		effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO
	});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.14) + 3.1 + (contextKey === "directional" ? 0.52 : 0), hslToRgb(hueB, 0.88, 0.58), 0.24 + metrics.bassHit * 0.34 + metrics.kickGate * 0.16, contextKey === "directional" ? 0.72 : 0.92, {
		softness: contextKey === "directional" ? 0.26 : 0.34,
		sweep: 0.12,
		effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO
	});
	applyFixtureGroupsToLightingState(state, 0.18);
};

const createTestLabPresetDefinition = function(args) {
	return {
		name: args.familyName,
		description: args.description,
		familyName: args.familyName,
		variantKey: args.variantKey,
		variantLabel: args.variantLabel,
		surfaceKey: args.surfaceKey,
		buildState: function(state, timeSeconds, audioMetrics) {
			args.buildState(state, timeSeconds, audioMetrics, args.variantKey);
		}
	};
};

const testLabLightingFamilyDefinitions = [
	{
		familyName: "Soft Wash",
		variants: [
			createTestLabPresetDefinition({
				familyName: "Soft Wash",
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				description: "Broad diffuse ceiling fill for neutral room-light evaluation",
				buildState: buildTestLabSoftWash
			}),
			createTestLabPresetDefinition({
				familyName: "Soft Wash",
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				description: "Broad wall fill to test whether Soft Wash still reads as room light on vertical surfaces",
				buildState: buildTestLabSoftWash
			}),
			createTestLabPresetDefinition({
				familyName: "Soft Wash",
				variantKey: "floor",
				variantLabel: "Floor",
				surfaceKey: "floor",
				description: "Diffuse floor spill to check whether Soft Wash belongs on the floor at all",
				buildState: buildTestLabSoftWash
			})
		]
	},
	{
		familyName: "Shutters",
		variants: [
			createTestLabPresetDefinition({
				familyName: "Shutters",
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				description: "Striped ceiling wash for shutter readability without panel-like framing",
				buildState: buildTestLabShutters
			}),
			createTestLabPresetDefinition({
				familyName: "Shutters",
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				description: "Striped wall wash to compare vertical slicing against the ceiling version",
				buildState: buildTestLabShutters
			})
		]
	},
	{
		familyName: "Edge Runner",
		variants: [
			createTestLabPresetDefinition({
				familyName: "Edge Runner",
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				description: "Side-wall runner beams for left-right lane motion evaluation",
				buildState: buildTestLabEdgeRunner
			}),
			createTestLabPresetDefinition({
				familyName: "Edge Runner",
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				description: "Ceiling-track runner test to judge whether this family belongs overhead or not",
				buildState: buildTestLabEdgeRunner
			})
		]
	},
	{
		familyName: "Silhouette Cut",
		variants: [
			createTestLabPresetDefinition({
				familyName: "Silhouette Cut",
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				description: "Hard wall reveal cut for room-opening evaluation",
				buildState: buildTestLabSilhouetteCut
			}),
			createTestLabPresetDefinition({
				familyName: "Silhouette Cut",
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				description: "Overhead reveal cut to compare against the wall opening behavior",
				buildState: buildTestLabSilhouetteCut
			})
		]
	},
	{
		familyName: "Room Window Beat",
		variants: [
			createTestLabPresetDefinition({
				familyName: "Room Window Beat",
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				description: "Beat-linked wall window for rhythmic reveal evaluation",
				buildState: buildTestLabRoomWindowBeat
			}),
			createTestLabPresetDefinition({
				familyName: "Room Window Beat",
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				description: "Beat-linked ceiling window to test whether the effect stays distinct overhead",
				buildState: buildTestLabRoomWindowBeat
			})
		]
	},
	{
		familyName: "Aurora Curtain",
		variants: [
			createTestLabPresetDefinition({
				familyName: "Aurora Curtain",
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				description: "Aurora-style ceiling bands for ribbon readability evaluation",
				buildState: buildTestLabAuroraCurtain
			}),
			createTestLabPresetDefinition({
				familyName: "Aurora Curtain",
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				description: "Wall-mounted aurora ribbons to verify whether the family should stay ceiling-only",
				buildState: buildTestLabAuroraCurtain
			})
		]
	},
	{
		familyName: "Floor Halo",
		variants: [
			createTestLabPresetDefinition({
				familyName: "Floor Halo",
				variantKey: "floor",
				variantLabel: "Centered",
				surfaceKey: "floor",
				description: "Centered floor underglow for ring and core visibility evaluation",
				buildState: buildTestLabFloorHalo
			}),
			createTestLabPresetDefinition({
				familyName: "Floor Halo",
				variantKey: "directional",
				variantLabel: "Directional",
				surfaceKey: "floor",
				description: "Offset floor underglow to test whether a directional floor read works better than symmetry",
				buildState: buildTestLabFloorHalo
			})
		]
	}
];

const testLabLightingPresetDefinitions = [];

for (let familyIndex = 0; familyIndex < testLabLightingFamilyDefinitions.length; familyIndex += 1) {
	const familyDefinition = testLabLightingFamilyDefinitions[familyIndex];
	familyDefinition.startPresetIndex = testLabLightingPresetDefinitions.length;
	for (let variantIndex = 0; variantIndex < familyDefinition.variants.length; variantIndex += 1) {
		const presetDefinition = familyDefinition.variants[variantIndex];
		presetDefinition.familyIndex = familyIndex;
		presetDefinition.variantIndex = variantIndex;
		testLabLightingPresetDefinitions.push(presetDefinition);
	}
}

const getTestLabLightingFamilyNames = function() {
	const names = [];
	for (let i = 0; i < testLabLightingFamilyDefinitions.length; i += 1) {
		names.push(testLabLightingFamilyDefinitions[i].familyName);
	}
	return names;
};

const getTestLabPresetMetaByIndex = function(index) {
	if (!testLabLightingPresetDefinitions.length) {
		return null;
	}
	return testLabLightingPresetDefinitions[(index + testLabLightingPresetDefinitions.length) % testLabLightingPresetDefinitions.length];
};

const getTestLabFamilyByIndex = function(index) {
	if (!testLabLightingFamilyDefinitions.length) {
		return null;
	}
	return testLabLightingFamilyDefinitions[(index + testLabLightingFamilyDefinitions.length) % testLabLightingFamilyDefinitions.length];
};

const getTestLabPresetIndexForFamilyVariant = function(familyIndex, variantIndex) {
	const familyDefinition = getTestLabFamilyByIndex(familyIndex);
	if (!familyDefinition || !familyDefinition.variants || !familyDefinition.variants.length) {
		return 0;
	}
	return familyDefinition.startPresetIndex + (variantIndex + familyDefinition.variants.length) % familyDefinition.variants.length;
};
