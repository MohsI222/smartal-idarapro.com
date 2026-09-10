# Plan for Refining Arabic PDF Rendering in Auto & Real Estate Module

This plan outlines the fixes to be applied to `/Users/macbookair/smart-al-idara-pro/src/pages/modules/AutoRealEstateModule.tsx` to ensure the Arabic labels are rendered correctly when generating/exporting documents.

## Proposed Changes:

1. **Title Fix:**
   - Change `"ع د ك راء سري ارة"` to `"عقد كرا سيارة"`. We will make sure that the mapping for the document title `car_rental` inside `DOCUMENT_LABELS` is updated. 
   - *Note:* In the source code, `DOCUMENT_LABELS["ar-MA"].car_rental` is currently set to `"عقد كراء سيارة"`. If it gets garbled as `"ع د ك راء سري ارة"` during export, we will trace the issue inside `buildDraft` or `documentHtml` or wherever ArabicReshaper is applied. Wait! We should verify if there is any other place where the title is spelled `"ع د ك راء سري ارة"`.

2. **Signature Section Tweak:**
   - Fix signature section labels to always read `"توقيع الطرف الأول"` and `"توقيع الطرف الثاني"` within the `PDF_TRANSLATIONS` map for `ar-MA` and `ar-SA`.
   - Ensure `signatureLabel: "التوقيع"` exists under `ar-MA` and `ar-SA` so that it renders as `"التوقيع"` instead of being reversed or missing.

3. **Document Subject (Main Title):**
   - Correct the document main title key `subject` to `"موضوع أوكسلي"` in both `"ar-MA"` and `"ar-SA"` translations inside `PDF_TRANSLATIONS`.

4. **Specific Labels (Brand, Fuel, Mileage, Terms):**
   - Correct `dataLabelBrand` to `"الماركة / النماذج"` (instead of just `"الماركة"`).
   - Ensure Fuel (`dataLabelFuel`) is set to `"الوقود"`.
   - Ensure Mileage (`dataLabelMileage`) is set to `"الكيلومترات"` or `fieldMileage` mapped dynamically.
   - Maintain dynamic fields (dates, Latin names like "Dacia Duster", etc.) exactly as is.

## Execution Plan:
- First, we will examine `buildDraft` and `documentHtml` in `/Users/macbookair/smart-al-idara-pro/src/pages/modules/AutoRealEstateModule.tsx` to see if `"ع د ك راء سري ارة"` is being hardcoded or if there's a custom reshaper function modifying it.
- Apply the string replacements using `replace_string_in_file` tool on `AutoRealEstateModule.tsx`.
