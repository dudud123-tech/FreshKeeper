import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ChoiceGroup, DateButton, Field, PrimaryButton, SecondaryButton, TabButton } from "./CommonControls";
import { labelForAiFallback, labelForAiProvider } from "../utils/aiLabels";
import { todayIso } from "../utils/date";

export default function AddItemPage({
  width,
  mode,
  setMode,
  name,
  setName,
  category,
  setCategory,
  categories,
  suggestCategory,
  storage,
  setStorage,
  storageTypes,
  expiry,
  setExpiry,
  openCalendar,
  submitManual,
  takeReceiptPhoto,
  pickReceiptImage,
  receiptExtractionMode,
  setReceiptExtractionMode,
  drafts,
  aiReceiptLoading,
  aiReceiptInfo,
  receiptImage,
  ocrLines,
  setReceiptSelectorVisible,
  setReceiptImageLayout,
  setReceiptImageSize,
  frameForOcrLine,
  selectedOcrLineIds,
  toggleOcrLine,
  ocrCoordinateOptions,
  ocrCoordinateModeIndex,
  setOcrCoordinateModeIndex,
  receiptStatus,
  bulkDraftForm,
  applyBulkDraftForm,
  addAllDrafts,
  draftForms,
  DEFAULT_EXPIRY_TYPE,
  removeDraft,
  updateDraftForm,
  addDraft
}) {
  return (
            <ScrollView
              style={{ width }}
              contentContainerStyle={styles.page}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.tabs}>
                    <TabButton active={mode === "manual"} label="직접입력" onPress={() => setMode("manual")} />
                    <TabButton active={mode === "receipt"} label="영수증" onPress={() => setMode("receipt")} />
                  </View>
                </View>

                {mode === "manual" ? (
                  <View style={styles.form}>
                    <Field label="상품명">
                      <TextInput
                        value={name}
                        onChangeText={(value) => {
                          setName(value);
                          setCategory(suggestCategory(value));
                        }}
                        placeholder="예: 서울우유, 계란, 딸기"
                        style={styles.input}
                      />
                    </Field>
                    <ChoiceGroup label="카테고리" options={categories} value={category} onChange={setCategory} />
                    <View style={styles.manualInlineGroups}>
                      <View style={styles.inlineGroupWide}>
                        <ChoiceGroup label="보관" options={storageTypes} value={storage} onChange={setStorage} compact />
                      </View>
                    </View>
                    <Field label="소비기한">
                      <DateButton value={expiry} onPress={() => openCalendar(expiry, setExpiry)} />
                    </Field>
                    <PrimaryButton label="등록하기" onPress={submitManual} />
                  </View>
                ) : (
                  <View style={styles.form}>
                    <ReceiptStep number="1" title="영수증 선택" description="촬영하거나 저장된 이미지를 불러오면 OCR 후보를 자동으로 표시합니다.">
                      <View style={styles.receiptActions}>
                        <PrimaryButton label="영수증 촬영" onPress={takeReceiptPhoto} />
                        <SecondaryButton label="이미지 불러오기" onPress={pickReceiptImage} />
                      </View>
                    </ReceiptStep>

                    <ReceiptStep
                      number="2"
                      title="추출 방식"
                      description="빠른 추출은 영수증에서 직접 줄을 고르고, AI 정리는 상품 후보를 먼저 정리해서 보여줍니다."
                    >
                      <View style={styles.extractModeGrid}>
                        <Pressable
                          style={[styles.extractModeCard, receiptExtractionMode === "fast" && styles.extractModeCardActive]}
                          onPress={() => setReceiptExtractionMode("fast")}
                        >
                          <Text style={[styles.extractModeTitle, receiptExtractionMode === "fast" && styles.extractModeTitleActive]}>빠른 추출</Text>
                          <Text style={styles.extractModeDescription}>OCR 박스를 보며 필요한 상품 줄을 직접 고릅니다.</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.extractModeCard, receiptExtractionMode === "ai" && styles.extractModeCardActive]}
                          onPress={() => setReceiptExtractionMode("ai")}
                        >
                          <Text style={[styles.extractModeTitle, receiptExtractionMode === "ai" && styles.extractModeTitleActive]}>AI 정리</Text>
                          <Text style={styles.extractModeDescription}>OCR 결과를 AI가 상품 후보만 추려서 보여줍니다.</Text>
                        </Pressable>
                      </View>
                    </ReceiptStep>

                    <ReceiptStep
                      number="3"
                      title={receiptExtractionMode === "ai" ? "AI 상품 후보" : "OCR 줄 확인"}
                      description={
                        receiptExtractionMode === "ai"
                          ? "AI가 정리한 상품 후보를 아래에서 확인하세요. 빠진 상품은 직접 고르기로 보완할 수 있습니다."
                          : "초록색은 상품 후보, 회색은 제외된 줄입니다. 박스가 어긋나면 좌표 맞춤을 바꿔보세요."
                      }
                    >
                      {receiptExtractionMode === "ai" ? (
                        <View style={styles.aiReceiptPanel}>
                          <Text style={styles.aiReceiptTitle}>{drafts.length > 0 ? `${drafts.length}개 후보를 찾았습니다.` : "AI 정리 결과를 기다리고 있습니다."}</Text>
                          <Text style={styles.aiProgressText}>
                            AI 정리는 이미지 박스를 보여주지 않고 상품 후보만 먼저 보여줍니다. 결과가 어색하면 영수증에서 직접 줄을 고를 수 있습니다.
                          </Text>
                          {aiReceiptLoading ? (
                            <View style={styles.aiProgressBox}>
                              <ActivityIndicator color="#1f7a5a" size="small" />
                              <View style={styles.aiProgressCopy}>
                                <Text style={styles.aiProgressTitle}>AI가 상품 후보를 정리하는 중</Text>
                                <Text style={styles.aiProgressText}>OCR 줄과 1차 후보를 비교해 상품명만 추려내고 있습니다.</Text>
                              </View>
                            </View>
                          ) : aiReceiptInfo ? (
                            <View style={styles.aiResultBox}>
                              <View style={styles.aiResultHeader}>
                                <Text style={styles.aiResultTitle}>결과 생성 방식</Text>
                                <Text style={styles.aiProviderPill}>{labelForAiProvider(aiReceiptInfo.provider)}</Text>
                              </View>
                              <Text style={styles.aiResultMeta}>
                                {aiReceiptInfo.model ? `모델 ${aiReceiptInfo.model} · ` : ""}OCR {aiReceiptInfo.ocrLineCount || 0}줄 · 1차 후보 {aiReceiptInfo.localCandidateCount || 0}개
                              </Text>
                              {aiReceiptInfo.fallbackFrom ? <Text style={styles.aiFallbackText}>{labelForAiFallback(aiReceiptInfo.fallbackFrom)}</Text> : null}
                              {aiReceiptInfo.requestId ? <Text style={styles.aiRequestText}>요청 ID {aiReceiptInfo.requestId}</Text> : null}
                              {aiReceiptInfo.candidates?.length ? (
                                <View style={styles.aiReasonList}>
                                  {aiReceiptInfo.candidates.slice(0, 5).map((candidate, index) => (
                                    <View key={`${candidate.name}-${index}`} style={styles.aiReasonItem}>
                                      <Text style={styles.aiReasonName}>
                                        {candidate.name}
                                        {candidate.confidence !== null ? ` · ${Math.round(candidate.confidence * 100)}%` : ""}
                                      </Text>
                                      {candidate.reason ? <Text style={styles.aiReasonText}>{candidate.reason}</Text> : null}
                                    </View>
                                  ))}
                                  {aiReceiptInfo.candidates.length > 5 ? <Text style={styles.aiRequestText}>외 {aiReceiptInfo.candidates.length - 5}개 후보</Text> : null}
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                          {receiptImage && ocrLines.length > 0 ? (
                            <SecondaryButton label="영수증에서 직접 고르기" onPress={() => setReceiptSelectorVisible(true)} />
                          ) : null}
                        </View>
                      ) : receiptImage ? (
                        <View
                          style={styles.receiptImageWrap}
                          onLayout={(event) => {
                            setReceiptImageLayout({
                              width: event.nativeEvent.layout.width,
                              height: event.nativeEvent.layout.height
                            });
                          }}
                        >
                          <Image
                            source={{ uri: receiptImage }}
                            style={styles.receiptImage}
                            onLoad={(event) => {
                              const source = event.nativeEvent.source;
                              if (source?.width && source?.height) {
                                setReceiptImageSize({ width: source.width, height: source.height });
                              }
                            }}
                          />
                          {ocrLines.map((line) => {
                            const frame = frameForOcrLine(line);
                            if (!frame) return null;
                            const selected = selectedOcrLineIds.includes(line.id);
                            return (
                              <Pressable
                                key={line.id}
                                accessibilityLabel={`${line.text} 선택`}
                                hitSlop={8}
                                style={[styles.ocrBox, selected ? styles.ocrBoxSelected : styles.ocrBoxUnselected, frame]}
                                onPress={() => toggleOcrLine(line)}
                              />
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={styles.receiptEmptyText}>아직 선택된 영수증이 없습니다.</Text>
                      )}
                      {receiptExtractionMode === "fast" && receiptImage && ocrLines.length > 0 ? (
                        <View style={styles.receiptToolRow}>
                          <SecondaryButton label="영수증 크게 선택하기" onPress={() => setReceiptSelectorVisible(true)} />
                          {ocrCoordinateOptions.length > 1 ? (
                            <Pressable
                              style={styles.coordinateButton}
                              onPress={() => setOcrCoordinateModeIndex((current) => (current + 1) % ocrCoordinateOptions.length)}
                            >
                              <Text style={styles.coordinateButtonText}>좌표 맞춤: {ocrCoordinateOptions[ocrCoordinateModeIndex]?.label}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}
                      <Text style={styles.status}>{receiptStatus}</Text>
                    </ReceiptStep>

                    <ReceiptStep number="4" title={`상품 후보 등록 (${drafts.length})`} description="상품 후보를 확인하고 소비기한을 정한 뒤 보관함에 등록합니다.">
                      {drafts.length > 0 ? (
                        <View style={styles.bulkBox}>
                          <Text style={styles.label}>일괄 등록 설정</Text>
                          <Field label="소비기한">
                            <DateButton value={bulkDraftForm.expiry} compact onPress={() => openCalendar(bulkDraftForm.expiry, (value) => applyBulkDraftForm({ expiry: value }))} />
                          </Field>
                          <PrimaryButton label="모두 등록" onPress={addAllDrafts} />
                        </View>
                      ) : (
                        <Text style={styles.receiptEmptyText}>상품으로 선택된 OCR 줄이 없습니다.</Text>
                      )}
                      <View style={styles.draftList}>
                        {drafts.map((draft) => (
                          <View key={draft} style={styles.draftItem}>
                            <View style={styles.draftText}>
                              <Text style={styles.itemName}>{draft}</Text>
                              <Text style={styles.meta}>
                                {draftForms[draft]?.category || suggestCategory(draft)} · {DEFAULT_EXPIRY_TYPE} {draftForms[draft]?.expiry || bulkDraftForm.expiry}
                              </Text>
                              <View style={styles.draftControls}>
                                <Pressable style={styles.removeDraftButton} accessibilityLabel="후보 삭제" onPress={() => removeDraft(draft)}>
                                  <Text style={styles.removeDraftText}>삭제</Text>
                                </Pressable>
                                <View style={styles.draftActionRow}>
                                  <Pressable
                                    style={styles.dateMiniButton}
                                    accessibilityLabel="날짜 선택"
                                    onPress={() => openCalendar(draftForms[draft]?.expiry || todayIso(7), (value) => updateDraftForm(draft, { expiry: value }))}
                                  >
                                    <Text style={styles.dateMiniIcon}>▦</Text>
                                  </Pressable>
                                  <Pressable style={styles.smallButton} accessibilityLabel="상품 등록" onPress={() => addDraft(draft)}>
                                    <Text style={styles.smallButtonText}>등록</Text>
                                  </Pressable>
                                </View>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    </ReceiptStep>
                  </View>
                )}
              </View>
            </ScrollView>
  );
}

function ReceiptStep({ number, title, description, children }) {
  return (
    <View style={styles.receiptStep}>
      <View style={styles.receiptStepHeader}>
        <Text style={styles.receiptStepBadge}>{number}</Text>
        <View style={styles.receiptStepCopy}>
          <Text style={styles.receiptStepTitle}>{title}</Text>
          {description ? <Text style={styles.receiptStepDescription}>{description}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 16,
    paddingBottom: 18
  },
  section: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    padding: 14,
    marginTop: 8
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  tabs: {
    flexDirection: "row",
    borderRadius: 8,
    backgroundColor: "#f3f0e8",
    padding: 3
  },
  form: {
    gap: 8,
    marginTop: 10
  },
  extractModeGrid: {
    flexDirection: "row",
    gap: 10
  },
  extractModeCard: {
    flex: 1,
    minHeight: 106,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    backgroundColor: "#fff",
    padding: 12,
    justifyContent: "center",
    gap: 6
  },
  extractModeCardActive: {
    borderWidth: 2,
    borderColor: "#1f7a5a",
    backgroundColor: "#edf7f2"
  },
  extractModeTitle: {
    color: "#18201c",
    fontSize: 16,
    fontWeight: "900"
  },
  extractModeTitleActive: {
    color: "#14583f"
  },
  extractModeDescription: {
    color: "#68716b",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  aiReceiptPanel: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b9dfcf",
    backgroundColor: "#f4fbf8",
    padding: 12
  },
  aiReceiptTitle: {
    color: "#14583f",
    fontSize: 16,
    fontWeight: "900"
  },
  aiProgressBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b9dfcf",
    backgroundColor: "#eef8f3",
    padding: 10
  },
  aiProgressCopy: {
    flex: 1,
    gap: 2
  },
  aiProgressTitle: {
    color: "#14583f",
    fontSize: 13,
    fontWeight: "900"
  },
  aiProgressText: {
    color: "#68716b",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  aiResultBox: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d8e8df",
    backgroundColor: "#ffffff",
    padding: 10
  },
  aiResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  aiResultTitle: {
    color: "#17211c",
    fontSize: 13,
    fontWeight: "900"
  },
  aiProviderPill: {
    color: "#14583f",
    fontSize: 11,
    fontWeight: "900",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b9dfcf",
    backgroundColor: "#eef8f3",
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden"
  },
  aiResultMeta: {
    color: "#68716b",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800"
  },
  aiFallbackText: {
    color: "#b45a2b",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "900"
  },
  aiRequestText: {
    color: "#8a938d",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700"
  },
  aiReasonList: {
    gap: 6
  },
  aiReasonItem: {
    borderRadius: 8,
    backgroundColor: "#f7f5ef",
    padding: 8,
    gap: 2
  },
  aiReasonName: {
    color: "#17211c",
    fontSize: 12,
    fontWeight: "900"
  },
  aiReasonText: {
    color: "#68716b",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700"
  },
  label: {
    color: "#68716b",
    fontSize: 13,
    fontWeight: "800"
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#18201c",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  receiptStep: {
    gap: 10,
    paddingTop: 14,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#ece6dc"
  },
  receiptStepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  receiptStepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#1f7a5a",
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 26,
    textAlign: "center"
  },
  receiptStepCopy: {
    flex: 1,
    gap: 3
  },
  receiptStepTitle: {
    color: "#18201c",
    fontSize: 16,
    fontWeight: "900"
  },
  receiptStepDescription: {
    color: "#68716b",
    fontSize: 12,
    lineHeight: 18
  },
  receiptActions: {
    gap: 10
  },
  status: {
    color: "#14583f",
    fontSize: 13,
    lineHeight: 19
  },
  receiptEmptyText: {
    color: "#68716b",
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 8
  },
  manualInlineGroups: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  inlineGroupWide: {
    flex: 1.05
  },
  receiptImageWrap: {
    width: "100%",
    height: 280,
    borderRadius: 8,
    backgroundColor: "#faf7f0",
    overflow: "hidden"
  },
  receiptImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain"
  },
  ocrBox: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 4
  },
  ocrBoxSelected: {
    borderColor: "#1f7a5a",
    backgroundColor: "rgba(31, 122, 90, 0.045)"
  },
  ocrBoxUnselected: {
    borderColor: "#7d857f",
    backgroundColor: "rgba(104, 113, 107, 0.015)"
  },
  receiptToolRow: {
    gap: 8
  },
  coordinateButton: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b9dfcf",
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  coordinateButtonText: {
    color: "#14583f",
    fontWeight: "900"
  },
  draftList: {
    gap: 10
  },
  draftItem: {
    gap: 6,
    borderWidth: 1,
    borderColor: "#e2ddd3",
    borderRadius: 8,
    padding: 9
  },
  draftText: {
    gap: 3
  },
  draftControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 5
  },
  removeDraftButton: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 2
  },
  removeDraftText: {
    color: "#9f3929",
    fontSize: 13,
    fontWeight: "900"
  },
  draftActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  dateMiniButton: {
    width: 36,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9cfc0",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0
  },
  dateMiniIcon: {
    color: "#18201c",
    fontSize: 18,
    fontWeight: "900"
  },
  bulkBox: {
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9cfc0",
    backgroundColor: "#faf7f0",
    padding: 10
  },
  smallButton: {
    minWidth: 50,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#edf7f2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0
  },
  smallButtonText: {
    color: "#14583f",
    fontSize: 13,
    fontWeight: "900"
  },
  itemName: {
    color: "#18201c",
    fontSize: 16,
    fontWeight: "900",
    flexShrink: 1
  },
  meta: {
    color: "#68716b",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
});
