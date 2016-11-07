/**
 * 因为百度翻译 API 要收费，所以没有使用官方提供的接口，而是直接使用 fanyi.baidu.com 的翻译接口
 */

var superagent = require('superagent')

// http://api.fanyi.baidu.com/api/trans/product/apidoc#languageList
var standard2custom = {
  en: 'en',
  th: 'th',
  ru: 'ru',
  pt: 'pt',
  el: 'el',
  nl: 'nl',
  pl: 'pl',
  bg: 'bul',
  et: 'est',
  da: 'dan',
  fi: 'fin',
  cs: 'cs',
  ro: 'rom',
  sl: 'slo',
  sv: 'swe',
  hu: 'hu',
  de: 'de',
  it: 'it',
  zh: 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'cht',
  'zh-hk': 'yue',
  ja: 'jp',
  ko: 'kor',
  es: 'spa',
  fr: 'fra',
  ar: 'ara'
}

var custom2standard = {
  en: 'en',
  th: 'th',
  ru: 'ru',
  pt: 'pt',
  el: 'el',
  nl: 'nl',
  pl: 'pl',
  bul: 'bg',
  est: 'et',
  dan: 'da',
  fin: 'fi',
  cs: 'cs',
  rom: 'ro',
  slo: 'sl',
  swe: 'sv',
  hu: 'hu',
  de: 'de',
  it: 'it',
  zh: 'zh-CN',
  cht: 'zh-TW',
  yue: 'zh-HK',
  jp: 'ja',
  kor: 'ko',
  spa: 'es',
  fra: 'fr',
  ara: 'ar'
};

/**
 * 百度翻译构造函数
 */
function BaiDu () {
  this.name = '百度翻译'
  this.type = 'BaiDu'
  this.link = 'http://fanyi.baidu.com/'
}

/**
 * 在自定义语种与标准语种之间转换，默认会将标准语种转换为自定义语种
 * @param {String} lang
 * @param {Boolean} [invert] - 但如果 invert 为真值，则会将自定义语种转换为标准语种
 * @return {String}
 */
var langResolve = BaiDu.resolve = function (lang, invert) {
  return (invert ? custom2standard : standard2custom)[lang.toLowerCase()] || null
}

var p = BaiDu.prototype

/**
 * 翻译的方法
 * @param queryObj
 * @returns {Promise}
 */
p.translate = function (queryObj) {
  var that = this
  return new Promise(function (resolve, reject) {
    superagent
      .get(that.link + '/v2transapi')
      .query({
        from: standard2custom[queryObj.from] || 'auto',
        to: standard2custom[queryObj.to] || 'zh', // 非标准接口一定要提供目标语种
        query: queryObj.text,
        transtype: 'hash',
        simple_means_flag: 3
      })
      .end(function (err, res) {
        if (err) {
          reject(err)
        } else {
          resolve(that.transform(res.body, queryObj))
        }
      })
  })
}

/**
 * 百度翻译返回的数据结构
 * @typedef {Object} BaiDuRes
 * @property {Number} [error_code] - 百度翻译错误码
 * @property {String} from - 翻译结果的源语种，百度格式的
 * @property {String} to - 翻译结果的目标语种，百度格式的
 * @property {{src:String,dst:String}[]} [trans_result] - 翻译结果，偶尔抽风可能没有
 */

/**
 * 将百度接口的数据转换为统一格式
 * @param {BaiDuRes} rawRes
 * @param {Query} queryObj
 * @returns {{}}
 */
p.transform = function (rawRes, queryObj) {
  var obj = {
    text: queryObj.text,
    response: rawRes
  }

  // 源语种、目标语种与在线翻译地址
  try {
    var trans_result = rawRes.trans_result || {}
    obj.from = langResolve(trans_result.from, true)
    obj.to = langResolve(trans_result.to, true)
    obj.linkToResult = this.link + '#auto/' + (trans_result.to || 'auto') + '/' + queryObj.text
  } catch (e) {}

  // 详细释义
  try {
    var detailed = []
    rawRes.dict_result.simple_means.symbols[0].parts.forEach(function (v) {
      detailed.push(v.part + ' ' + v.means.join('，'))
    })
    obj.detailed = detailed
  } catch (e) {}

  // 翻译结果
  try {
    obj.result = rawRes.trans_result.data.map(function (v) {
      return v.dst
    })
  } catch (e) {}

  if (!obj.detailed && !obj.result) {
    obj.error = this.name + '没有返回有效的翻译结果，请稍后重试。'
  }

  return obj
}

/**
 * 检测语种的方法， 返回的语种为百度自己格式的语种。
 * @param {Query} queryObj
 * @returns {Promise}
 */
p.detect = function (queryObj) {
  var that = this
  return new Promise(function (resolve, reject) {
    var from = queryObj.from

    if (from) {
      if (langResolve(from)) {
        resolve(from)
      } else {
        reject(null)
      }
      return
    }

    superagent
      .post(that.link + '/langdetect')
      .send('query=' + queryObj.text.slice(0, 73))
      .end(function (err, res) {
        if (err) return reject(err)

        var body = res.body
        if (0 === body.error) {
          var lang = langResolve(body.lan, true)
          if (lang) return resolve(lang)
        }

        reject(null)
      })
  })
}

/**
 * 返回语音播放的 url
 * @param queryObj
 * @returns {Promise}
 */
p.audio = function (queryObj) {
  return this
    .detect(queryObj)
    .then(function (lang) { return 'http://fanyi.baidu.com/gettts?lan=' + langResolve(lang) + '&text=' + queryObj.text + '&spd=2&source=web' })
}

module.exports = BaiDu
