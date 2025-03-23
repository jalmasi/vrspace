package org.vrspace.server.obj;

import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.PublicKey;
import java.security.spec.InvalidKeySpecException;
import java.util.Base64;

import org.bouncycastle.jce.ECNamedCurveTable;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.jce.spec.ECNamedCurveParameterSpec;
import org.bouncycastle.jce.spec.ECPublicKeySpec;
import org.bouncycastle.math.ec.ECPoint;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@NoArgsConstructor
@AllArgsConstructor
@ToString(callSuper = false)
@Node
public class WebPushSubscription extends Entity {
  @JsonIgnore
  @Relationship(type = "SUBSCRIBED_CLIENT", direction = Relationship.Direction.OUTGOING)
  private Client client;
  private String endpoint;
  private String key;
  private String auth;

  // CHECKME: none of these methods are used, will any be useful?
  @JsonIgnore
  public byte[] getAuthAsBytes() {
    return Base64.getDecoder().decode(getAuth());
  }

  @JsonIgnore
  public byte[] getKeyAsBytes() {
    return Base64.getDecoder().decode(getKey());
  }

  @JsonIgnore
  public PublicKey getUserPublicKey()
      throws NoSuchAlgorithmException, InvalidKeySpecException, NoSuchProviderException {
    KeyFactory kf = KeyFactory.getInstance("ECDH", BouncyCastleProvider.PROVIDER_NAME);
    ECNamedCurveParameterSpec ecSpec = ECNamedCurveTable.getParameterSpec("secp256r1");
    ECPoint point = ecSpec.getCurve().decodePoint(getKeyAsBytes());
    ECPublicKeySpec pubSpec = new ECPublicKeySpec(point, ecSpec);

    return kf.generatePublic(pubSpec);
  }

}
