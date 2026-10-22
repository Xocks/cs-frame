import Foundation
import Vision
import ImageIO
let request = VNDetectFaceRectanglesRequest()
for path in CommandLine.arguments.dropFirst() {
 do {
  let handler = VNImageRequestHandler(url: URL(fileURLWithPath:path), options: [:])
  try handler.perform([request])
  let faces = (request.results ?? []).map { o -> [String:Double] in
    let r=o.boundingBox
    return ["x":Double(r.origin.x),"y":Double(1-r.origin.y-r.size.height),"width":Double(r.size.width),"height":Double(r.size.height),"confidence":Double(o.confidence)]
  }
  var result: [String:Any] = ["path":path,"faces":faces]
  if let source = CGImageSourceCreateWithURL(URL(fileURLWithPath:path) as CFURL, nil),
     let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString:Any],
     let exif = properties[kCGImagePropertyExifDictionary] as? [CFString:Any],
     let captured = exif[kCGImagePropertyExifDateTimeOriginal] as? String {
    result["dateTimeOriginal"] = captured
  }
  let data=try JSONSerialization.data(withJSONObject:result)
  print(String(data:data,encoding:.utf8)!)
 } catch { print("{\"error\":\"face detection failed\"}") }
}
