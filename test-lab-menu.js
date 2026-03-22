// TestLab uses a reduced menu so effect review stays focused.

const getTestLabAudioModeLabel = function(args) {
	args = args || {};
	if (args.audioSourceKind === "debug") {
		return "Debug";
	}
	if (args.audioSourceKind === "stream") {
		return args.audioSourceName ? "Live: " + args.audioSourceName : "Live";
	}
	return "None";
};

const getTestLabSelectionMeta = function(args) {
	args = args || {};
	if (typeof getTestLabPresetMetaByIndex !== "function") {
		return {
			metadata: null,
			familyDefinition: null,
			familyCount: 1,
			variantCount: 1
		};
	}
	const metadata = getTestLabPresetMetaByIndex(args.currentLightPresetIndex || 0);
	const familyDefinition = metadata && typeof getTestLabFamilyByIndex === "function" ? getTestLabFamilyByIndex(metadata.familyIndex || 0) : null;
	return {
		metadata: metadata,
		familyDefinition: familyDefinition,
		familyCount: typeof testLabLightingFamilyDefinitions !== "undefined" && testLabLightingFamilyDefinitions.length ? testLabLightingFamilyDefinitions.length : 1,
		variantCount: familyDefinition && familyDefinition.variants && familyDefinition.variants.length ? familyDefinition.variants.length : 1
	};
};

const createTestLabAudioBarItems = function(audioMetrics) {
	audioMetrics = audioMetrics || emptyAudioMetrics;
	return [
		{label: "Level", value: clampNumber(audioMetrics.level || 0, 0, 1)},
		{label: "Bass", value: clampNumber(audioMetrics.bass || 0, 0, 1)},
		{label: "Transient", value: clampNumber(audioMetrics.transient || 0, 0, 1)},
		{label: "Beat Pulse", value: clampNumber(audioMetrics.beatPulse || 0, 0, 1)},
		{label: "Strobe", value: clampNumber(audioMetrics.strobeGate || 0, 0, 1)},
		{label: "Left Hit", value: clampNumber(audioMetrics.leftImpact || 0, 0, 1)},
		{label: "Right Hit", value: clampNumber(audioMetrics.rightImpact || 0, 0, 1)}
	];
};

const createTestLabMenuSections = function(args) {
	args = args || {};
	const selectionMeta = getTestLabSelectionMeta(args);
	const controls = [
		createCyclerMenuControlState({
			key: "sceneLightPreset",
			label: "Active Effect",
			valueText: args.currentLightPresetFamilyName || args.currentLightPresetName || "Soft Wash",
			metaText: args.currentLightPresetDescription || "",
			hoveredAction: args.hoveredLightPresetAction || ""
		})
	];
	if (args.sceneLightingPrimaryControl) {
		controls.push(createSliderMenuControlState({
			key: args.sceneLightingPrimaryControl.key,
			label: args.sceneLightingPrimaryControl.label,
			valueText: formatMenuPercentText(args.sceneLightingPrimaryControl.value),
			sliderU: args.sceneLightingPrimarySliderU || 0,
			minLabel: args.sceneLightingPrimaryControl.minLabel,
			maxLabel: args.sceneLightingPrimaryControl.maxLabel,
			hoveredBool: !!args.sceneLightingPrimaryHoverBool,
			activeBool: !!args.sceneLightingPrimaryActiveBool
		}));
	}
	return [
		createMenuSectionState({
			key: "testLabEffect",
			title: "Effect Review",
			badgeText: ((selectionMeta.metadata && selectionMeta.metadata.familyIndex != null ? selectionMeta.metadata.familyIndex : 0) + 1) + " / " + selectionMeta.familyCount,
			statusText: "Context: " + ((selectionMeta.metadata && selectionMeta.metadata.variantIndex != null ? selectionMeta.metadata.variantIndex : 0) + 1) + " / " + selectionMeta.variantCount + " " + (args.currentLightPresetVariantLabel || "Base") + " | Surface: " + (args.currentLightPresetSurfaceKey || "mixed"),
			controls: controls
		}),
		createMenuSectionState({
			key: "testLabIsolation",
			title: "Isolation",
			statusText: "Audio: " + getTestLabAudioModeLabel(args) + " | Baseline: Uniform / Manual / Mix 100%",
			controls: []
		}),
		createSessionMenuSectionState({
			xrSessionActiveBool: !!args.xrSessionActiveBool,
			hoveredExitVrBool: !!args.hoveredExitVrBool
		})
	].filter(Boolean);
};
