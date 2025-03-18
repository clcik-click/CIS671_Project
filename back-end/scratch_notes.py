        # 4️⃣ Read Image and Resize While Keeping Aspect Ratio
        image = cv2.imread(image_path)
        if image is None:
            return jsonify({"error": "Could not read image"}), 500

        original_h, original_w, _   = image.shape  # Original image size
        scale                       = SCREEN_HEIGHT / original_h  # Scale factor
        new_w                       = int(original_w * scale)  # Maintain aspect ratio
        new_h                       = SCREEN_HEIGHT
        image_resized               = cv2.resize(image, (new_w, new_h))

        # 5️⃣ Draw Strokes on Image (Scale Strokes to New Image Size)
        for stroke in strokes:
            points = stroke["points"]
            for i in range(1, len(points)):  
                pt1 = (
                    int(points[i-1]["x"] * scale),  # Scale X
                    int(points[i-1]["y"] * scale),  # Scale Y
                )
                pt2 = (
                    int(points[i]["x"] * scale),  
                    int(points[i]["y"] * scale),  
                )
                cv2.line(image_resized, pt1, pt2, (0, 0, 255), 2)  # Red stroke

        # 6️⃣ Display Image with Strokes
        cv2.imshow("Image with Strokes", image_resized)
        cv2.waitKey(0)  # Wait for key press to close window
        cv2.destroyAllWindows()