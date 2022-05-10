// const crypto = require('crypto');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcrypt');

var secret = '=]3ewc,XB4@)BX?9.J&BF-8/KVhZz,2C{X5-Zh*Bn4(D62dGSR[6ANf28pLfxm+b[q@y%.=W3hY5H&i5k)Tx!]$yLD3{..=i*p]]gZG-6{JpR#f6hEY5?+!m96p,Sm]hvm7P:RmxC$AmdfG=#=@*gM';
// var secret2 = 'nF59wYj6&rjr7ajwcVRdpic2#';
// var algorithm = 'aes-256-ctr'
// , ENCRYPTION_KEY  = '3J!5N3!ovfA92h%z^Vj3K2Ac38r%G5&6'
// , IV_LENGTH  = 16;

export function Generate(value: string, callback: Function) {
    bcrypt.hash(value, 12, (err: any, hash: string) => {
        if (err) throw err;
        callback(hash);
    });
    // crypto.pbkdf2(value, salt, 100000, 64, 'sha512', (err, derivedKey) => {
    //     if (err) throw err;
    //     callback(derivedKey.toString('hex'));        
    // });
}

// function CreateToken(id, expire) {
//     return jwt.sign({ id: id + secret2 }, secret, {
//         expiresIn: expire // expires in 24 hours
//     });
// }

// function GetUserIdByToken(token) {
//     const obj = jwt.verify(token, secret);

//     if (!obj || !obj.id) return null;

//     return {id: obj.id.replace(secret2, '')};
// }


// export function Encrypt(text: string): string{
//     let iv = crypto.randomBytes(IV_LENGTH);
//     let cipher = crypto.createCipheriv(algorithm, Buffer.from(ENCRYPTION_KEY), iv);
//     let encrypted = cipher.update(text);
   
//     encrypted = Buffer.concat([encrypted, cipher.final()]);
   
//     return iv.toString('hex') + ':' + encrypted.toString('hex');
// }
   
// export function Decrypt(text: string): string{
//     let textParts = text.split(':');
//     let iv = Buffer.from(textParts.shift()!, 'hex');
//     let encryptedText = Buffer.from(textParts.join(':'), 'hex');
//     let decipher = crypto.createDecipheriv(algorithm, Buffer.from(ENCRYPTION_KEY), iv);
//     let decrypted = decipher.update(encryptedText);

//     decrypted = Buffer.concat([decrypted, decipher.final()]);

//     return decrypted.toString();
// }

export function Encrypt(text: string) {
    return jwt.sign({ data: text }, secret, { expiresIn: '367d' });
    // jwt.sign({ foo: 'bar' }, secret, { algorithm: 'RS256' }, function(err: any, token: string) {
    //     callback(token);
    // });
}

export function Decrypt(token: string) {
    let decoded = jwt.verify(token, secret);
    
    if (!decoded) return null;

    return decoded.data;

    // jwt.verify(token, secret, { algorithm: 'RS256' }, function(err: any, decoded: string) {
    //     callback(decoded);
    // });
}

export function RandomString(length: number, opts: object): string {
    var defaults = {lowercase: true, uppercase: true, numbers: true, symbols: true};
    var opt = {...defaults, ...opts}
    var result           = '';
    var characters       = (opt.uppercase ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':'') + (opt.lowercase ? 'abcdefghijklmnopqrstuvwxyz' : '') + (opt.numbers ? '0123456789' : '') + (opt.symbols ? '[]_:;=)(/&%$#!|\@£§€{}»«<>' : '');
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }

export function IsValid(value: string, hash: string, callback: Function) : void
{
     bcrypt.compare(value, hash, (err: any, result: boolean) => callback(err ? false : result));
}

export default {
    Encrypt,
    Decrypt,
    // RandomString: (length) => crypto.randomBytes(length).toString('hex'),
    // CreateToken,
    // GetUserIdByToken,
    RandomString,
    Generate,
    IsValid
    //IsValid: (value, saltValue, callback) => Generate(value, (generatedValue) => callback(generatedValue == saltValue))
}