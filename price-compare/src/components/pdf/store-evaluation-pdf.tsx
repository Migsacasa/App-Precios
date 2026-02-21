import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 11 },
  title: { fontSize: 18, marginBottom: 12 },
  section: { marginBottom: 14 },
  h2: { fontSize: 12, marginBottom: 6 },
  row: { display: "flex", flexDirection: "row", gap: 12 },
  col: { flexGrow: 1 },
  badge: { padding: 6, borderWidth: 1, borderRadius: 6, display: "flex" },
  small: { fontSize: 9, color: "#555" },
  table: { borderWidth: 1, borderRadius: 6, overflow: "hidden" },
  tr: { flexDirection: "row", borderBottomWidth: 1 },
  th: { flex: 1, padding: 6, fontSize: 10, fontWeight: 700 },
  td: { flex: 1, padding: 6 },
  img: { width: 250, height: 150, objectFit: "cover", borderRadius: 6, marginBottom: 6 },
  bullet: { marginLeft: 10, marginBottom: 2 },
});

export type PdfData = {
  store: {
    customerCode: string;
    name: string;
    city?: string | null;
    zone?: string | null;
    lat: number;
    lng: number;
  };
  evaluation: {
    capturedAt: string;
    createdByEmail?: string | null;
    aiRating?: string | null;
    aiScore?: number | null;
    aiConfidence?: number | null;
    finalRating?: string | null;
    overrideReason?: string | null;
  };
  photos: Array<{ url: string; photoType: string }>;
  indices: Array<{
    segment: string;
    slot: number;
    competitorPrice?: string | null;
    ourPrice?: string | null;
    priceIndex?: string | null;
  }>;
  ai: {
    summary?: string | null;
    whyBullets?: string[] | null;
    evidence?: Array<{ type: string; severity: string; detail: string; segment?: string | null }>;
    recommendations?: Array<{ priority: string; action: string; rationale?: string | null }>;
  };
};

export function StoreEvaluationPdf({ data }: { data: PdfData }) {
  const { store, evaluation, photos, indices, ai } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Retail Store Evaluation Report</Text>

        <View style={styles.section}>
          <Text style={styles.h2}>Store</Text>
          <Text>{store.customerCode} — {store.name}</Text>
          <Text style={styles.small}>
            {store.city ?? "-"} / {store.zone ?? "-"} • GPS: {store.lat}, {store.lng}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Result</Text>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.badge}>Final Rating: {evaluation.finalRating ?? "-"}</Text>
              <Text style={styles.small}>
                Captured: {evaluation.capturedAt}
              </Text>
              <Text style={styles.small}>
                AI: {evaluation.aiRating ?? "-"} • Score: {evaluation.aiScore ?? "-"} • Conf: {evaluation.aiConfidence ?? "-"}
              </Text>
              {evaluation.overrideReason ? (
                <Text style={styles.small}>Override Reason: {evaluation.overrideReason}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Photos</Text>
          <View style={styles.row}>
            {photos.slice(0, 2).map((p, idx) => (
              <View key={idx} style={styles.col}>
                <Image style={styles.img} src={p.url} />
                <Text style={styles.small}>{p.photoType}</Text>
              </View>
            ))}
          </View>
          {photos.length > 2 ? (
            <View style={{ marginTop: 8 }}>
              <Image style={styles.img} src={photos[2].url} />
              <Text style={styles.small}>{photos[2].photoType}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>AI Summary</Text>
          <Text>{ai.summary ?? "-"}</Text>
          <View style={{ marginTop: 6 }}>
            {(ai.whyBullets ?? []).slice(0, 8).map((b, i) => (
              <Text key={i} style={styles.bullet}>• {b}</Text>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Segment Price Index Inputs</Text>
          <View style={styles.table}>
            <View style={styles.tr}>
              <Text style={styles.th}>Segment</Text>
              <Text style={styles.th}>Slot</Text>
              <Text style={styles.th}>Competitor</Text>
              <Text style={styles.th}>Our</Text>
              <Text style={styles.th}>Index</Text>
            </View>
            {indices.map((r, i) => (
              <View key={i} style={styles.tr}>
                <Text style={styles.td}>{r.segment}</Text>
                <Text style={styles.td}>{String(r.slot)}</Text>
                <Text style={styles.td}>{r.competitorPrice ?? "-"}</Text>
                <Text style={styles.td}>{r.ourPrice ?? "-"}</Text>
                <Text style={styles.td}>{r.priceIndex ?? "-"}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Recommendations</Text>
          {(ai.recommendations ?? []).slice(0, 12).map((r, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <Text>({r.priority}) {r.action}</Text>
              {r.rationale ? <Text style={styles.small}>{r.rationale}</Text> : null}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
