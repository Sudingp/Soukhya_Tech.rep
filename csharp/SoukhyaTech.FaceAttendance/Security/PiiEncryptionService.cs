using System.Security.Cryptography;
using System.Text;

namespace SoukhyaTech.FaceAttendance.Security
{
    public class PiiEncryptionService
    {
        private readonly string _key;
        private static readonly HashSet<string> PiiFields = new()
        {
            "aadhaar_number", "pan_number", "phone_no", "email", "card_number"
        };

        public PiiEncryptionService(IConfiguration config)
        {
            _key = config["Encryption:PiiKey"] ?? "dev-pii-key-32-bytes-long!!";
        }

        public string Encrypt(string plaintext)
        {
            if (string.IsNullOrEmpty(plaintext)) return "";
            using var aes = Aes.Create();
            aes.Key = Encoding.UTF8.GetBytes(_key.PadRight(32).Substring(0, 32));
            aes.GenerateIV();
            var iv = aes.IV;
            using var encryptor = aes.CreateEncryptor();
            var bytes = Encoding.UTF8.GetBytes(plaintext);
            var encrypted = encryptor.TransformFinalBlock(bytes, 0, bytes.Length);
            return Convert.ToBase64String(iv) + ":" + Convert.ToBase64String(encrypted);
        }

        public string Decrypt(string ciphertext)
        {
            if (string.IsNullOrEmpty(ciphertext)) return "";
            try
            {
                var parts = ciphertext.Split(':');
                var iv = Convert.FromBase64String(parts[0]);
                var encrypted = Convert.FromBase64String(parts[1]);
                using var aes = Aes.Create();
                aes.Key = Encoding.UTF8.GetBytes(_key.PadRight(32).Substring(0, 32));
                aes.IV = iv;
                using var decryptor = aes.CreateDecryptor();
                var bytes = decryptor.TransformFinalBlock(encrypted, 0, encrypted.Length);
                return Encoding.UTF8.GetString(bytes);
            }
            catch { return ""; }
        }

        public string Mask(string field, string value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            return field switch
            {
                "aadhaar_number" => "XXXX-XXXX-" + value.Substring(value.LastIndexOf('-') + 1),
                "pan_number" => "XXXXX" + value.Substring(5, 4) + "X",
                "phone_no" => value.Substring(0, 4) + " *****-" + value.Substring(value.Length - 5),
                "email" => value[0] + "***@" + value.Split('@')[1],
                "card_number" => "****" + value.Substring(value.Length - 4),
                _ => value
            };
        }

        public bool IsPiiField(string field) => PiiFields.Contains(field);
    }
}
