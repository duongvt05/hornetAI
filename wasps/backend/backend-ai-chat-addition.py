"""
HƯỚNG DẪN THÊM VÀO app.py - AI Chat endpoint

Dán đoạn code dưới đây vào app.py, TRƯỚC dòng: if __name__ == "__main__":
"""

# ─── AI CHAT ENDPOINT ─────────────────────────────────────────────────────────
# Cần cài thêm: pip install anthropic
# Thêm vào .env:  ANTHROPIC_API_KEY=sk-ant-...

import anthropic as anthropic_sdk  # rename để tránh conflict

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

HORNET_SYSTEM_PROMPT = """Bạn là trợ lý AI của hệ thống HornetAI — hệ thống giám sát và bảo vệ đàn ong mật 
khỏi ong bắp cày xâm lấn (đặc biệt là Vespa velutina). 

Chuyên môn của bạn:
- Sinh học ong bắp cày và ong mật
- Nhận dạng các loài: Vespa velutina (nguy hiểm cao), Vespa crabro (trung bình), Vespula sp. (thấp)
- Chiến lược bảo vệ tổ ong: thu hẹp cửa tổ, đặt bẫy, hệ thống âm thanh xua đuổi 18kHz
- Phân tích dữ liệu phát hiện từ camera YOLOv8
- Tư vấn nuôi ong, mùa vụ, dịch bệnh

Trả lời bằng tiếng Việt, ngắn gọn và thực tế."""


@app.route("/api/v1/ai/chat", methods=["POST"])
@jwt_required()
def ai_chat():
    """
    POST /api/v1/ai/chat
    Body: {
        "message": "Câu hỏi của user",
        "history": [{"role": "user"|"assistant", "content": "..."}]  // optional
    }
    """
    if not ANTHROPIC_API_KEY:
        return jsonify({"error": "ANTHROPIC_API_KEY chưa được cấu hình trong .env"}), 503

    data    = request.get_json()
    message = data.get("message", "").strip()
    history = data.get("history", [])  # Conversation history

    if not message:
        return jsonify({"error": "Vui lòng nhập câu hỏi"}), 400

    # Giới hạn history để tránh vượt context
    if len(history) > 20:
        history = history[-20:]

    try:
        client = anthropic_sdk.Anthropic(api_key=ANTHROPIC_API_KEY)

        messages = [*history, {"role": "user", "content": message}]

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=HORNET_SYSTEM_PROMPT,
            messages=messages,
        )

        reply = response.content[0].text

        return jsonify({
            "success": True,
            "response": reply,
            "model":    response.model,
        })

    except anthropic_sdk.APIError as e:
        return jsonify({"success": False, "error": str(e)}), 502
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ─── DETECTION CONTEXT ENDPOINT ───────────────────────────────────────────────
@app.route("/api/v1/ai/context", methods=["GET"])
@jwt_required()
def get_detection_context():
    """
    Trả về tóm tắt ngắn về các phát hiện gần đây để truyền vào prompt AI.
    Frontend có thể gọi API này rồi đưa kết quả vào system prompt.
    """
    limit  = request.args.get("limit", 10, type=int)
    events = (DetectionEvent.query
              .order_by(DetectionEvent.timestamp.desc())
              .limit(limit)
              .all())

    if not events:
        return jsonify({"context": "Chưa có phát hiện nào trong hệ thống."})

    lines = []
    for e in events:
        lines.append(
            f"- [{e.timestamp.strftime('%d/%m %H:%M')}] Camera {e.camera_name}: "
            f"{e.count} {e.dominant_species} (mức độ: {e.overall_severity})"
        )

    context = "Các phát hiện gần đây:\n" + "\n".join(lines)
    return jsonify({"context": context, "count": len(events)})